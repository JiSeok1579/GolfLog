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


def clamp(value, low, high):
    return max(low, min(high, value))


def distance(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def keypoint_xy(keypoints, name, min_score=0.2):
    value = keypoints.get(name)
    if not isinstance(value, list) or len(value) < 3 or value[2] < min_score:
        return None
    return (float(value[0]), float(value[1]))


def segment_distance(point, start, end):
    sx, sy = start
    ex, ey = end
    px, py = point
    dx = ex - sx
    dy = ey - sy
    length_sq = dx * dx + dy * dy
    if length_sq <= 0.001:
        return distance(point, start), start
    t = clamp(((px - sx) * dx + (py - sy) * dy) / length_sq, 0.0, 1.0)
    projection = (sx + dx * t, sy + dy * t)
    return distance(point, projection), projection


def estimate_body_scale(keypoints, width, height):
    left_shoulder = keypoint_xy(keypoints, "left_shoulder", min_score=0.15)
    right_shoulder = keypoint_xy(keypoints, "right_shoulder", min_score=0.15)
    if left_shoulder and right_shoulder:
        return max(distance(left_shoulder, right_shoulder), width * 0.08)
    return max(width * 0.12, height * 0.12, 80)


def body_keypoint_points(keypoints):
    names = [
        "head",
        "neck",
        "left_shoulder",
        "right_shoulder",
        "left_elbow",
        "right_elbow",
        "left_hip",
        "right_hip",
        "left_knee",
        "right_knee",
    ]
    return [point for point in (keypoint_xy(keypoints, name, min_score=0.15) for name in names) if point]


def expanded_body_box(keypoints, body_scale, width, height):
    points = body_keypoint_points(keypoints)
    if not points:
        return None
    padding = body_scale * 0.28
    return (
        clamp(min(point[0] for point in points) - padding, 0, width),
        clamp(min(point[1] for point in points) - padding, 0, height),
        clamp(max(point[0] for point in points) + padding, 0, width),
        clamp(max(point[1] for point in points) + padding, 0, height),
    )


def point_in_box(point, box):
    if not box:
        return False
    return box[0] <= point[0] <= box[2] and box[1] <= point[1] <= box[3]


def detect_club_from_frame(image, keypoints, frame_index, total_frames):
    try:
        import cv2
    except Exception:
        return None

    left_wrist = keypoint_xy(keypoints, "left_wrist")
    right_wrist = keypoint_xy(keypoints, "right_wrist")
    if not left_wrist or not right_wrist:
        return None

    height, width = image.shape[:2]
    grip = ((left_wrist[0] + right_wrist[0]) / 2, (left_wrist[1] + right_wrist[1]) / 2)
    body_scale = estimate_body_scale(keypoints, width, height)
    roi_radius = max(body_scale * 2.7, width * 0.16, height * 0.18, 120)
    x1 = int(clamp(grip[0] - roi_radius, 0, width - 1))
    y1 = int(clamp(grip[1] - roi_radius, 0, height - 1))
    x2 = int(clamp(grip[0] + roi_radius, x1 + 1, width))
    y2 = int(clamp(grip[1] + roi_radius, y1 + 1, height))
    crop = image[y1:y2, x1:x2]
    if crop.size == 0:
        return None

    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    edges = cv2.Canny(gray, 55, 165)
    min_line_length = int(max(body_scale * 0.55, 38))
    max_line_gap = int(max(body_scale * 0.24, 12))
    lines = cv2.HoughLinesP(
        edges,
        rho=1,
        theta=math.pi / 180,
        threshold=18,
        minLineLength=min_line_length,
        maxLineGap=max_line_gap,
    )
    if lines is None:
        return None

    grip_tolerance = max(body_scale * 0.42, 24)
    expected_length = max(body_scale * 1.15, 70)
    body_box = expanded_body_box(keypoints, body_scale, width, height)
    body_points = body_keypoint_points(keypoints)
    frame_progress = frame_index / max(total_frames - 1, 1)
    best = None
    for raw_line in lines:
        lx1, ly1, lx2, ly2 = [float(value) for value in raw_line[0]]
        start = (lx1 + x1, ly1 + y1)
        end = (lx2 + x1, ly2 + y1)
        line_length = distance(start, end)
        if line_length < min_line_length:
            continue

        grip_distance, _ = segment_distance(grip, start, end)
        if grip_distance > grip_tolerance:
            continue

        start_distance = distance(grip, start)
        end_distance = distance(grip, end)
        head = start if start_distance >= end_distance else end
        head_distance = max(start_distance, end_distance)
        if head_distance < expected_length * 0.45:
            continue
        nearest_body_distance = min((distance(head, point) for point in body_points), default=expected_length)
        if nearest_body_distance < body_scale * 0.18:
            continue

        score = (
            0.5 * clamp(head_distance / expected_length, 0.0, 1.0)
            + 0.35 * (1.0 - clamp(grip_distance / grip_tolerance, 0.0, 1.0))
            + 0.15 * clamp(line_length / expected_length, 0.0, 1.0)
        )
        if point_in_box(head, body_box):
            score *= 0.55
        if nearest_body_distance < body_scale * 0.42:
            score *= clamp(nearest_body_distance / (body_scale * 0.42), 0.35, 1.0)
        if frame_progress >= 0.56 and abs(head[1] - grip[1]) < body_scale * 0.32:
            score *= 0.45
        if not best or score > best["score"]:
            best = {
                "grip": grip,
                "head": head,
                "score": score,
            }

    if not best:
        return None

    return {
        "grip": {
            "x": round(best["grip"][0], 2),
            "y": round(best["grip"][1], 2),
        },
        "head": {
            "x": round(clamp(best["head"][0], 0, width), 2),
            "y": round(clamp(best["head"][1], 0, height), 2),
        },
        "score": round(clamp(best["score"], 0.25, 0.92), 3),
    }


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
            "clubDetectedFrames": 0,
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

            frame_payload = {
                "frame": frame_index,
                "time": round(frame_index / fps, 4),
                "keypoints": keypoints,
            }
            club = detect_club_from_frame(image, keypoints, frame_index, frame_count or frame_index + 1)
            if club:
                frame_payload["club"] = club

            frames.append(frame_payload)
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
            "clubDetectedFrames": sum(1 for frame in frames if frame.get("club")),
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

                frame_payload = {
                    "frame": frame_index,
                    "time": round(frame_index / fps, 4),
                    "keypoints": keypoints,
                }
                club = detect_club_from_frame(image, keypoints, frame_index, frame_count or frame_index + 1)
                if club:
                    frame_payload["club"] = club

                frames.append(frame_payload)
                frame_index += 1
    finally:
        capture.release()

    if not frames:
        raise RuntimeError("no_pose_frames")

    return {
        "debug": {
            "droppedFrames": dropped_frames,
            "frameCount": frame_count or frame_index,
            "clubDetectedFrames": sum(1 for frame in frames if frame.get("club")),
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
