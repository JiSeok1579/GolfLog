#!/usr/bin/env python3
import argparse
import json
import math
import os
import subprocess
import sys
import tempfile
from pathlib import Path


DEFAULT_TASK_MODEL_NAME = "pose_landmarker_full.task"

MEDIAPIPE_NAME_MAP = {
    "NOSE": "head",
    "LEFT_SHOULDER": "left_shoulder",
    "RIGHT_SHOULDER": "right_shoulder",
    "LEFT_ELBOW": "left_elbow",
    "RIGHT_ELBOW": "right_elbow",
    "LEFT_WRIST": "left_wrist",
    "RIGHT_WRIST": "right_wrist",
    "LEFT_HIP": "left_hip",
    "RIGHT_HIP": "right_hip",
    "LEFT_KNEE": "left_knee",
    "RIGHT_KNEE": "right_knee",
    "LEFT_ANKLE": "left_ankle",
    "RIGHT_ANKLE": "right_ankle",
}


def parse_args():
    parser = argparse.ArgumentParser(description="Estimate 2D golf swing pose frames.")
    parser.add_argument("--video", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--model", default="mediapipe")
    parser.add_argument("--runtime", choices=["auto", "solutions", "tasks", "fallback"], default=os.environ.get("GOLFLOG_POSE_RUNTIME", "auto"))
    parser.add_argument("--view-angle", default="down-the-line")
    parser.add_argument("--club-type", default="Driver")
    parser.add_argument("--dominant-hand", default="right")
    parser.add_argument("--landmarker-model", default=None)
    parser.add_argument("--max-frames", type=int, default=140)
    parser.add_argument("--mediapipe-child", action="store_true", help=argparse.SUPPRESS)
    return parser.parse_args()


def midpoint(a, b):
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, min(a[2], b[2])]


def video_metadata(video_path):
    try:
        import cv2

        capture = cv2.VideoCapture(video_path)
        if not capture.isOpened():
            return 1280, 720, 30.0, 72
        fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
        width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 1280)
        height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 720)
        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 72)
        capture.release()
        return width, height, fps, frame_count
    except Exception:
        return 1280, 720, 30.0, 72


def synthetic_keypoints(frame_index, width, height, total_frames):
    progress = frame_index / max(total_frames - 1, 1)
    swing = math.sin(progress * math.pi * 2)
    top = math.sin(progress * math.pi)
    center_x = width * (0.51 + 0.025 * swing)
    head_y = height * (0.22 - 0.015 * top)
    shoulder_y = height * (0.38 - 0.025 * top)
    hip_y = height * 0.61
    hand_y = height * (0.62 - 0.42 * top)
    hand_x = center_x + width * (0.12 * math.cos(progress * math.pi * 2) - 0.02)
    score = 0.48

    return {
        "head": [center_x, head_y, score],
        "neck": [center_x, shoulder_y - height * 0.04, score],
        "left_shoulder": [center_x - width * 0.1, shoulder_y, score],
        "right_shoulder": [center_x + width * 0.1, shoulder_y, score],
        "left_elbow": [center_x - width * 0.08, (shoulder_y + hand_y) / 2, score],
        "right_elbow": [center_x + width * 0.08, (shoulder_y + hand_y) / 2, score],
        "left_wrist": [hand_x - width * 0.025, hand_y, score],
        "right_wrist": [hand_x + width * 0.025, hand_y, score],
        "left_hip": [center_x - width * 0.08, hip_y, score],
        "right_hip": [center_x + width * 0.08, hip_y, score],
        "left_knee": [center_x - width * 0.1, height * 0.8, score],
        "right_knee": [center_x + width * 0.1, height * 0.8, score],
        "left_ankle": [center_x - width * 0.12, height * 0.94, score],
        "right_ankle": [center_x + width * 0.12, height * 0.94, score],
    }


def fallback_result(args, reason):
    width, height, fps, total_frames = video_metadata(args.video)
    step = max(1, math.ceil(total_frames / max(args.max_frames, 1)))
    frames = []
    for frame_index in range(total_frames):
        if frame_index % step != 0:
            continue
        frames.append(
            {
                "frame": frame_index,
                "time": round(frame_index / fps, 4),
                "keypoints": synthetic_keypoints(frame_index, width, height, total_frames),
            }
        )

    return {
        "debug": {
            "droppedFrames": 0,
            "fallbackReason": reason,
            "frameCount": total_frames,
            "runtime": "fallback",
        },
        "durationSec": total_frames / fps,
        "fps": fps,
        "frames": frames,
        "height": height,
        "model": f"{args.model}-fallback",
        "width": width,
    }


def resolve_landmarker_model(args):
    candidates = []
    if args.landmarker_model:
        candidates.append(Path(args.landmarker_model))

    env_model = os.environ.get("GOLFLOG_POSE_LANDMARKER_MODEL")
    if env_model:
        candidates.append(Path(env_model))

    data_file = os.environ.get("GOLFLOG_DATA_FILE")
    if data_file:
        candidates.append(Path(data_file).expanduser().parent / "models" / DEFAULT_TASK_MODEL_NAME)

    candidates.extend(
        [
            Path("/Volumes/X31/golflog-data/models") / DEFAULT_TASK_MODEL_NAME,
            Path(__file__).resolve().parents[2] / "server-data" / "models" / DEFAULT_TASK_MODEL_NAME,
        ]
    )

    for candidate in candidates:
        path = candidate.expanduser()
        if path.exists():
            return path

    return None


def mediapipe_result(args):
    import cv2
    import mediapipe as mp

    if args.runtime == "fallback":
        raise RuntimeError("fallback_runtime_requested")

    if args.runtime == "solutions":
        if not hasattr(mp, "solutions"):
            raise RuntimeError("mediapipe_solutions_unavailable")
        return mediapipe_solutions_result(args, cv2, mp)

    if args.runtime == "tasks":
        return mediapipe_tasks_result(args, cv2, mp)

    if hasattr(mp, "solutions"):
        return mediapipe_solutions_result(args, cv2, mp)

    if not args.landmarker_model and os.environ.get("GOLFLOG_POSE_ENABLE_TASKS") != "1":
        raise RuntimeError("mediapipe_solutions_unavailable")

    return mediapipe_tasks_result(args, cv2, mp)


def child_args(args, output_path):
    command = [
        sys.executable,
        str(Path(__file__).resolve()),
        "--video",
        args.video,
        "--out",
        output_path,
        "--model",
        args.model,
        "--runtime",
        args.runtime,
        "--view-angle",
        args.view_angle,
        "--club-type",
        args.club_type,
        "--dominant-hand",
        args.dominant_hand,
        "--max-frames",
        str(args.max_frames),
        "--mediapipe-child",
    ]
    if args.landmarker_model:
        command.extend(["--landmarker-model", args.landmarker_model])
    return command


def isolated_mediapipe_result(args):
    if args.runtime == "fallback":
        return fallback_result(args, "fallback_runtime_requested")

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(prefix="golflog-pose-worker-", suffix=".json", delete=False) as temp_file:
            temp_path = temp_file.name

        completed = subprocess.run(
            child_args(args, temp_path),
            cwd=str(Path(__file__).resolve().parents[2]),
            env={
                **os.environ,
                "MPLCONFIGDIR": os.environ.get("MPLCONFIGDIR", "/tmp/mpl"),
                "PYTHONDONTWRITEBYTECODE": os.environ.get("PYTHONDONTWRITEBYTECODE", "1"),
            },
            stderr=subprocess.PIPE,
            stdout=subprocess.PIPE,
            text=True,
            timeout=max(30, int(os.environ.get("GOLFLOG_POSE_WORKER_TIMEOUT_SEC", "150"))),
        )
        if completed.returncode != 0:
            stderr = (completed.stderr or completed.stdout or "").strip().splitlines()
            reason = stderr[-1] if stderr else f"exit_code_{completed.returncode}"
            return fallback_result(args, f"mediapipe_isolated_failed:{completed.returncode}:{reason}")

        return json.loads(Path(temp_path).read_text(encoding="utf-8"))
    except subprocess.TimeoutExpired:
        return fallback_result(args, "mediapipe_isolated_timeout")
    except Exception as exc:
        return fallback_result(args, f"mediapipe_isolated_error:{type(exc).__name__}:{exc}")
    finally:
        if temp_path:
            try:
                Path(temp_path).unlink()
            except OSError:
                pass


def mediapipe_solutions_result(args, cv2, mp):
    capture = cv2.VideoCapture(args.video)
    if not capture.isOpened():
        raise RuntimeError("video_open_failed")

    fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 1280)
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 720)
    frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    step = max(1, math.ceil(frame_count / max(args.max_frames, 1))) if frame_count > 0 else 1
    pose = mp.solutions.pose.Pose(
        enable_segmentation=False,
        min_detection_confidence=0.35,
        min_tracking_confidence=0.35,
        model_complexity=1,
        smooth_landmarks=True,
        static_image_mode=False,
    )

    frames = []
    dropped_frames = 0
    frame_index = 0

    try:
        while True:
            ok, image = capture.read()
            if not ok:
                break
            if frame_index % step != 0:
                frame_index += 1
                continue

            rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            result = pose.process(rgb)
            if not result.pose_landmarks:
                dropped_frames += 1
                frame_index += 1
                continue

            keypoints = {}
            landmarks = result.pose_landmarks.landmark
            for landmark_name, output_name in MEDIAPIPE_NAME_MAP.items():
                landmark = landmarks[getattr(mp.solutions.pose.PoseLandmark, landmark_name).value]
                keypoints[output_name] = [
                    landmark.x * width,
                    landmark.y * height,
                    getattr(landmark, "visibility", 0.0),
                ]

            if "left_shoulder" in keypoints and "right_shoulder" in keypoints:
                keypoints["neck"] = midpoint(keypoints["left_shoulder"], keypoints["right_shoulder"])

            frames.append(
                {
                    "frame": frame_index,
                    "time": round(frame_index / fps, 4),
                    "keypoints": keypoints,
                }
            )
            frame_index += 1
    finally:
        pose.close()
        capture.release()

    if not frames:
        raise RuntimeError("no_pose_frames")

    return {
        "debug": {
            "droppedFrames": dropped_frames,
            "frameCount": frame_count or frame_index,
            "runtime": "mediapipe_solutions",
        },
        "durationSec": (frame_count or frame_index) / fps,
        "fps": fps,
        "frames": frames,
        "height": height,
        "model": "mediapipe",
        "width": width,
    }


def mediapipe_tasks_result(args, cv2, mp):
    from mediapipe.tasks.python import BaseOptions
    from mediapipe.tasks.python import vision

    model_path = resolve_landmarker_model(args)
    if not model_path:
        raise RuntimeError("pose_landmarker_model_missing")

    capture = cv2.VideoCapture(args.video)
    if not capture.isOpened():
        raise RuntimeError("video_open_failed")

    fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 1280)
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 720)
    frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    step = max(1, math.ceil(frame_count / max(args.max_frames, 1))) if frame_count > 0 else 1
    options = vision.PoseLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(model_path), delegate=BaseOptions.Delegate.CPU),
        running_mode=vision.RunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.35,
        min_pose_presence_confidence=0.35,
        min_tracking_confidence=0.35,
        output_segmentation_masks=False,
    )

    frames = []
    dropped_frames = 0
    frame_index = 0

    try:
        with vision.PoseLandmarker.create_from_options(options) as landmarker:
            while True:
                ok, image = capture.read()
                if not ok:
                    break
                if frame_index % step != 0:
                    frame_index += 1
                    continue

                rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                timestamp_ms = int(round((frame_index / fps) * 1000))
                result = landmarker.detect_for_video(mp_image, timestamp_ms)
                if not result.pose_landmarks:
                    dropped_frames += 1
                    frame_index += 1
                    continue

                keypoints = {}
                landmarks = result.pose_landmarks[0]
                for landmark_name, output_name in MEDIAPIPE_NAME_MAP.items():
                    landmark = landmarks[getattr(vision.PoseLandmark, landmark_name).value]
                    keypoints[output_name] = [
                        landmark.x * width,
                        landmark.y * height,
                        getattr(landmark, "visibility", getattr(landmark, "presence", 0.0)),
                    ]

                if "left_shoulder" in keypoints and "right_shoulder" in keypoints:
                    keypoints["neck"] = midpoint(keypoints["left_shoulder"], keypoints["right_shoulder"])

                frames.append(
                    {
                        "frame": frame_index,
                        "time": round(frame_index / fps, 4),
                        "keypoints": keypoints,
                    }
                )
                frame_index += 1
    finally:
        capture.release()

    if not frames:
        raise RuntimeError("no_pose_frames")

    return {
        "debug": {
            "droppedFrames": dropped_frames,
            "frameCount": frame_count or frame_index,
            "runtime": "mediapipe_tasks",
            "taskModelPath": str(model_path),
        },
        "durationSec": (frame_count or frame_index) / fps,
        "fps": fps,
        "frames": frames,
        "height": height,
        "model": "mediapipe-tasks",
        "width": width,
    }


def main():
    args = parse_args()
    if args.mediapipe_child:
        result = mediapipe_result(args)
    elif args.model == "mediapipe":
        result = isolated_mediapipe_result(args)
    else:
        result = fallback_result(args, f"unsupported_model:{args.model}")

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "out": str(out_path), "model": result["model"]}))


if __name__ == "__main__":
    main()
