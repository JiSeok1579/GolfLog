#!/usr/bin/env python3
import argparse
import json
import math
from pathlib import Path

import cv2
import numpy as np


BONES = [
    ("head", "neck"),
    ("neck", "left_shoulder"),
    ("neck", "right_shoulder"),
    ("left_shoulder", "left_elbow"),
    ("left_elbow", "left_wrist"),
    ("right_shoulder", "right_elbow"),
    ("right_elbow", "right_wrist"),
    ("left_shoulder", "left_hip"),
    ("right_shoulder", "right_hip"),
    ("left_hip", "right_hip"),
    ("left_hip", "left_knee"),
    ("left_knee", "left_ankle"),
    ("right_hip", "right_knee"),
    ("right_knee", "right_ankle"),
]

CENTER_COLOR = (30, 220, 245)
LEFT_COLOR = (90, 220, 110)
RIGHT_COLOR = (255, 150, 65)
LOW_SCORE_COLOR = (150, 150, 150)
CLUB_COLOR = (240, 75, 220)


def parse_args():
    parser = argparse.ArgumentParser(description="Render a pose overlay contact sheet from GolfLog worker output.")
    parser.add_argument("--video", required=True)
    parser.add_argument("--analysis", required=True)
    parser.add_argument("--out", default="/tmp/golflog-pose-preview.jpg")
    parser.add_argument("--columns", type=int, default=4)
    parser.add_argument("--max-panels", type=int, default=12)
    parser.add_argument("--min-score", type=float, default=0.2)
    parser.add_argument("--tile-width", type=int, default=420)
    parser.add_argument("--require-real", action="store_true")
    return parser.parse_args()


def as_float(value, fallback=0.0):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return fallback
    return number if math.isfinite(number) else fallback


def clamp(value, minimum, maximum):
    return max(minimum, min(maximum, value))


def load_analysis(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    frames = data.get("frames")
    if not isinstance(frames, list) or not frames:
        raise SystemExit(f"No pose frames found in {path}")
    return data


def source_to_target(value, source_axis, target_axis, percent=False):
    number = as_float(value)
    if percent:
        return clamp((number / 100.0) * target_axis, 0, target_axis)
    if 0.0 <= number <= 1.0:
        return clamp(number * target_axis, 0, target_axis)
    return clamp((number / max(source_axis, 1)) * target_axis, 0, target_axis)


def keypoint_color(name, score, min_score):
    if score < min_score:
        return LOW_SCORE_COLOR
    if name.startswith("left_"):
        return LEFT_COLOR
    if name.startswith("right_"):
        return RIGHT_COLOR
    return CENTER_COLOR


def normalize_keypoints(frame, source_width, source_height, target_width, target_height):
    raw = frame.get("keypoints")
    points = {}
    if isinstance(raw, dict):
        for name, value in raw.items():
            if not isinstance(value, (list, tuple)) or len(value) < 2:
                continue
            score = as_float(value[2], 1.0) if len(value) > 2 else 1.0
            points[name] = {
                "x": source_to_target(value[0], source_width, target_width),
                "y": source_to_target(value[1], source_height, target_height),
                "score": clamp(score, 0.0, 1.0),
            }
    elif isinstance(raw, list):
        for item in raw:
            if not isinstance(item, dict) or "name" not in item:
                continue
            score = as_float(item.get("score"), 1.0)
            points[str(item["name"])] = {
                "x": source_to_target(item.get("x"), source_width, target_width, percent=True),
                "y": source_to_target(item.get("y"), source_height, target_height, percent=True),
                "score": clamp(score, 0.0, 1.0),
            }
    return points, isinstance(raw, list)


def club_point(value, source_width, source_height, target_width, target_height, percent):
    if not isinstance(value, dict):
        return None
    return (
        int(round(source_to_target(value.get("x"), source_width, target_width, percent=percent))),
        int(round(source_to_target(value.get("y"), source_height, target_height, percent=percent))),
    )


def select_frames(frames, max_panels):
    if len(frames) <= max_panels:
        return frames
    if max_panels <= 1:
        return [frames[0]]
    step = (len(frames) - 1) / (max_panels - 1)
    return [frames[int(round(index * step))] for index in range(max_panels)]


def draw_label(image, text, origin):
    x, y = origin
    cv2.rectangle(image, (x - 6, y - 18), (x + 520, y + 8), (20, 24, 28), thickness=-1)
    cv2.putText(image, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (245, 248, 250), 1, cv2.LINE_AA)


def draw_overlay(image, frame, analysis, source_width, source_height, min_score):
    target_height, target_width = image.shape[:2]
    points, percent_source = normalize_keypoints(frame, source_width, source_height, target_width, target_height)

    for start, end in BONES:
        first = points.get(start)
        second = points.get(end)
        if not first or not second:
            continue
        if first["score"] < min_score or second["score"] < min_score:
            continue
        cv2.line(
            image,
            (int(round(first["x"])), int(round(first["y"]))),
            (int(round(second["x"])), int(round(second["y"]))),
            (245, 245, 245),
            2,
            cv2.LINE_AA,
        )

    for name, point in points.items():
        color = keypoint_color(name, point["score"], min_score)
        center = (int(round(point["x"])), int(round(point["y"])))
        cv2.circle(image, center, 5, (15, 18, 22), thickness=-1, lineType=cv2.LINE_AA)
        cv2.circle(image, center, 3, color, thickness=-1, lineType=cv2.LINE_AA)

    club = frame.get("club")
    if isinstance(club, dict):
        score = as_float(club.get("score"), 1.0)
        grip = club_point(club.get("grip"), source_width, source_height, target_width, target_height, percent_source)
        head = club_point(club.get("head"), source_width, source_height, target_width, target_height, percent_source)
        if score >= 0.55 and grip and head:
            cv2.line(image, grip, head, CLUB_COLOR, 3, cv2.LINE_AA)
            cv2.circle(image, grip, 4, CLUB_COLOR, thickness=-1, lineType=cv2.LINE_AA)
            cv2.circle(image, head, 6, CLUB_COLOR, thickness=-1, lineType=cv2.LINE_AA)

    frame_index = int(round(as_float(frame.get("frame"), 0)))
    time_sec = as_float(frame.get("time", frame.get("timeSec")), 0.0)
    runtime = analysis.get("debug", {}).get("runtime", "")
    label = f"frame {frame_index} | {time_sec:.2f}s | {runtime}"
    draw_label(image, label, (12, 24))


def render_sheet(args, analysis):
    video_path = Path(args.video)
    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        raise SystemExit(f"Could not open video: {video_path}")

    video_width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or analysis.get("width") or 1280)
    video_height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or analysis.get("height") or 720)
    source_width = int(analysis.get("width") or video_width)
    source_height = int(analysis.get("height") or video_height)
    tile_width = max(240, args.tile_width)
    tile_height = max(160, int(round(video_height * (tile_width / max(video_width, 1)))))
    frames = select_frames(analysis["frames"], max(1, args.max_panels))
    columns = max(1, min(args.columns, len(frames)))
    rows = math.ceil(len(frames) / columns)
    header_height = 54
    sheet = np.full((header_height + rows * tile_height, columns * tile_width, 3), 242, dtype=np.uint8)

    title = (
        f"GolfLog pose preview | model={analysis.get('model', '')} | "
        f"runtime={analysis.get('debug', {}).get('runtime', '')} | panels={len(frames)}"
    )
    cv2.putText(sheet, title, (16, 34), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (30, 35, 40), 2, cv2.LINE_AA)

    for index, frame in enumerate(frames):
        frame_index = int(round(as_float(frame.get("frame"), 0)))
        capture.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
        ok, image = capture.read()
        if not ok:
            image = np.full((video_height, video_width, 3), 32, dtype=np.uint8)

        tile = cv2.resize(image, (tile_width, tile_height), interpolation=cv2.INTER_AREA)
        draw_overlay(tile, frame, analysis, source_width, source_height, args.min_score)
        row = index // columns
        col = index % columns
        y = header_height + row * tile_height
        x = col * tile_width
        sheet[y : y + tile_height, x : x + tile_width] = tile

    capture.release()
    return sheet


def main():
    args = parse_args()
    analysis = load_analysis(args.analysis)
    if args.require_real and "fallback" in str(analysis.get("model", "")).lower():
        reason = analysis.get("debug", {}).get("fallbackReason", "unknown")
        raise SystemExit(f"Pose preview requires real MediaPipe output, got fallback: {reason}")

    sheet = render_sheet(args, analysis)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(out_path), sheet):
        raise SystemExit(f"Could not write preview: {out_path}")

    panel_count = min(len(analysis["frames"]), max(1, args.max_panels))
    print(json.dumps({"ok": True, "out": str(out_path), "panels": panel_count, "model": analysis.get("model")}))


if __name__ == "__main__":
    main()
