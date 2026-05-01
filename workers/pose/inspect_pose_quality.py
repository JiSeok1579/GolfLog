#!/usr/bin/env python3
import argparse
import json
import math
from pathlib import Path


KEYPOINT_ORDER = [
    "head",
    "neck",
    "left_shoulder",
    "right_shoulder",
    "left_elbow",
    "right_elbow",
    "left_wrist",
    "right_wrist",
    "left_hip",
    "right_hip",
    "left_knee",
    "right_knee",
    "left_ankle",
    "right_ankle",
]


def parse_args():
    parser = argparse.ArgumentParser(description="Inspect GolfLog pose worker output for visible QA issues.")
    parser.add_argument("--analysis", required=True)
    parser.add_argument("--out", default="/tmp/golflog-pose-quality.md")
    parser.add_argument("--json-out", default="/tmp/golflog-pose-quality.json")
    parser.add_argument("--min-score", type=float, default=0.2)
    parser.add_argument("--jump-threshold", type=float, default=0.22)
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


def load_analysis(path, require_real):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    frames = data.get("frames")
    if not isinstance(frames, list) or not frames:
        raise SystemExit(f"No pose frames found in {path}")
    if require_real and "fallback" in str(data.get("model", "")).lower():
        reason = data.get("debug", {}).get("fallbackReason", "unknown")
        raise SystemExit(f"Pose quality inspection requires real output, got fallback: {reason}")
    return data


def normalize_axis(value, axis_size, percent=False):
    number = as_float(value)
    if percent:
        return clamp(number / 100.0, 0.0, 1.0)
    if 0.0 <= number <= 1.0:
        return number
    return clamp(number / max(axis_size, 1), 0.0, 1.0)


def normalize_keypoints(frame, width, height):
    raw = frame.get("keypoints")
    points = {}
    if isinstance(raw, dict):
        for name, value in raw.items():
            if not isinstance(value, (list, tuple)) or len(value) < 2:
                continue
            points[str(name)] = {
                "x": normalize_axis(value[0], width),
                "y": normalize_axis(value[1], height),
                "score": clamp(as_float(value[2], 1.0) if len(value) > 2 else 1.0, 0.0, 1.0),
            }
    elif isinstance(raw, list):
        for item in raw:
            if not isinstance(item, dict) or "name" not in item:
                continue
            points[str(item["name"])] = {
                "x": normalize_axis(item.get("x"), width, percent=True),
                "y": normalize_axis(item.get("y"), height, percent=True),
                "score": clamp(as_float(item.get("score"), 1.0), 0.0, 1.0),
            }
    return points


def frame_number(frame):
    return int(round(as_float(frame.get("frame"), 0)))


def point_distance(first, second):
    if not first or not second:
        return 0.0
    return math.hypot(first["x"] - second["x"], first["y"] - second["y"])


def normalize_club_point(value, width, height):
    if not isinstance(value, dict):
        return None
    x = normalize_axis(value.get("x"), width)
    y = normalize_axis(value.get("y"), height)
    return {"x": x, "y": y}


def normalize_club(frame, width, height):
    raw = frame.get("club")
    if not isinstance(raw, dict):
        return None
    grip = normalize_club_point(raw.get("grip"), width, height)
    head = normalize_club_point(raw.get("head"), width, height)
    if not grip or not head:
        return None
    return {
        "grip": grip,
        "head": head,
        "score": clamp(as_float(raw.get("score"), 1.0), 0.0, 1.0),
        "source": str(raw.get("source") or "unknown"),
    }


def top_items(items, limit=5):
    return items[:limit]


def inspect_club(normalized_frames, width, height, jump_threshold):
    detected = []
    missing = []
    low_score = []
    source_counts = {}
    length_values = []

    for frame, _ in normalized_frames:
        number = frame_number(frame)
        club = normalize_club(frame, width, height)
        if not club:
            missing.append(number)
            continue
        detected.append((number, club))
        source_counts[club["source"]] = source_counts.get(club["source"], 0) + 1
        length_values.append(point_distance(club["grip"], club["head"]))
        if club["score"] < 0.55:
            low_score.append({"frame": number, "score": round(club["score"], 3), "source": club["source"]})

    jumps = []
    previous = None
    for number, club in detected:
        if previous and previous[1]["score"] >= 0.55 and club["score"] >= 0.55:
            distance = point_distance(previous[1]["head"], club["head"])
            if distance >= jump_threshold:
                jumps.append(
                    {
                        "fromFrame": previous[0],
                        "toFrame": number,
                        "distance": round(distance, 3),
                        "source": club["source"],
                    }
                )
        previous = (number, club)

    scores = [club["score"] for _, club in detected]
    return {
        "detectedFrames": len(detected),
        "missingFrames": missing,
        "lowScoreFrames": low_score,
        "avgScore": round(sum(scores) / len(scores), 3) if scores else 0.0,
        "minScore": round(min(scores), 3) if scores else 0.0,
        "avgLength": round(sum(length_values) / len(length_values), 3) if length_values else 0.0,
        "sourceCounts": dict(sorted(source_counts.items())),
        "largeJumps": top_items(sorted(jumps, key=lambda item: item["distance"], reverse=True), 12),
    }


def inspect(analysis, min_score, jump_threshold):
    frames = analysis["frames"]
    width = int(analysis.get("width") or 1280)
    height = int(analysis.get("height") or 720)
    normalized_frames = [(frame, normalize_keypoints(frame, width, height)) for frame in frames]

    keypoint_stats = {}
    for name in KEYPOINT_ORDER:
        present = []
        low_score = []
        missing = []
        for frame, points in normalized_frames:
            number = frame_number(frame)
            point = points.get(name)
            if not point:
                missing.append(number)
                continue
            present.append((number, point["score"]))
            if point["score"] < min_score:
                low_score.append((number, point["score"]))

        scores = [score for _, score in present]
        worst = sorted(present, key=lambda item: item[1])
        keypoint_stats[name] = {
            "presentFrames": len(present),
            "missingFrames": missing,
            "lowScoreFrames": [{"frame": number, "score": round(score, 3)} for number, score in low_score],
            "avgScore": round(sum(scores) / len(scores), 3) if scores else 0.0,
            "minScore": round(min(scores), 3) if scores else 0.0,
            "worstFrames": [{"frame": number, "score": round(score, 3)} for number, score in top_items(worst)],
        }

    jumps = []
    previous_frame = None
    previous_points = None
    for frame, points in normalized_frames:
        if previous_frame is not None and previous_points is not None:
            for name in KEYPOINT_ORDER:
                first = previous_points.get(name)
                second = points.get(name)
                if not first or not second:
                    continue
                if first["score"] < min_score or second["score"] < min_score:
                    continue
                distance = point_distance(first, second)
                if distance >= jump_threshold:
                    jumps.append(
                        {
                            "keypoint": name,
                            "fromFrame": frame_number(previous_frame),
                            "toFrame": frame_number(frame),
                            "distance": round(distance, 3),
                        }
                    )
        previous_frame = frame
        previous_points = points

    low_score_counts = sorted(
        (
            {
                "keypoint": name,
                "lowScoreCount": len(stat["lowScoreFrames"]),
                "missingCount": len(stat["missingFrames"]),
                "avgScore": stat["avgScore"],
                "minScore": stat["minScore"],
            }
            for name, stat in keypoint_stats.items()
        ),
        key=lambda item: (item["missingCount"] + item["lowScoreCount"], -1 * item["minScore"]),
        reverse=True,
    )

    debug = analysis.get("debug", {}) if isinstance(analysis.get("debug"), dict) else {}
    return {
        "summary": {
            "model": analysis.get("model", ""),
            "runtime": debug.get("runtime", ""),
            "frames": len(frames),
            "frameCount": debug.get("frameCount", 0),
            "droppedFrames": debug.get("droppedFrames", 0),
            "fallbackReason": debug.get("fallbackReason"),
            "minScore": min_score,
            "jumpThreshold": jump_threshold,
        },
        "keypoints": keypoint_stats,
        "club": inspect_club(normalized_frames, width, height, jump_threshold),
        "attention": {
            "lowestConfidence": top_items(low_score_counts),
            "largeJumps": top_items(sorted(jumps, key=lambda item: item["distance"], reverse=True), 12),
        },
    }


def render_markdown(report):
    summary = report["summary"]
    lines = [
        "# Pose Quality Report",
        "",
        "## Summary",
        "",
        f"- model: `{summary['model']}`",
        f"- runtime: `{summary['runtime']}`",
        f"- sampled frames: `{summary['frames']}`",
        f"- source frame count: `{summary['frameCount']}`",
        f"- dropped frames: `{summary['droppedFrames']}`",
        f"- fallback reason: `{summary['fallbackReason']}`",
        f"- min score threshold: `{summary['minScore']}`",
        "",
        "## Keypoint Attention",
        "",
        "| keypoint | low-score frames | missing frames | avg score | min score |",
        "| --- | ---: | ---: | ---: | ---: |",
    ]

    for item in report["attention"]["lowestConfidence"]:
        lines.append(
            f"| `{item['keypoint']}` | {item['lowScoreCount']} | {item['missingCount']} | "
            f"{item['avgScore']:.3f} | {item['minScore']:.3f} |"
        )

    club = report["club"]
    source_counts = ", ".join(f"{source}: {count}" for source, count in club["sourceCounts"].items()) or "none"
    lines.extend(
        [
            "",
            "## Club Detection",
            "",
            f"- detected frames: `{club['detectedFrames']}`",
            f"- missing frames: `{len(club['missingFrames'])}`",
            f"- low-score frames: `{len(club['lowScoreFrames'])}`",
            f"- avg score: `{club['avgScore']:.3f}`",
            f"- min score: `{club['minScore']:.3f}`",
            f"- avg normalized length: `{club['avgLength']:.3f}`",
            f"- source counts: `{source_counts}`",
        ]
    )
    if club["lowScoreFrames"]:
        low = ", ".join(f"{item['frame']}({item['score']:.3f}, {item['source']})" for item in club["lowScoreFrames"][:12])
        lines.append(f"- low-score samples: {low}")
    if club["largeJumps"]:
        jump_list = ", ".join(
            f"{item['fromFrame']}->{item['toFrame']}({item['distance']:.3f}, {item['source']})"
            for item in club["largeJumps"][:8]
        )
        lines.append(f"- large head jumps: {jump_list}")

    lines.extend(["", "## Worst Frames", ""])
    for name, stat in report["keypoints"].items():
        worst = ", ".join(f"{item['frame']}({item['score']:.3f})" for item in stat["worstFrames"])
        low = ", ".join(f"{item['frame']}({item['score']:.3f})" for item in stat["lowScoreFrames"][:8])
        missing = ", ".join(str(item) for item in stat["missingFrames"][:8])
        lines.append(f"- `{name}` worst: {worst or 'none'}")
        if low:
            lines.append(f"  - low score: {low}")
        if missing:
            lines.append(f"  - missing: {missing}")

    lines.extend(["", "## Large Jumps", ""])
    if report["attention"]["largeJumps"]:
        for jump in report["attention"]["largeJumps"]:
            lines.append(
                f"- `{jump['keypoint']}` frame {jump['fromFrame']} -> {jump['toFrame']}: "
                f"{jump['distance']:.3f} normalized distance"
            )
    else:
        lines.append("- none above threshold")

    lines.append("")
    return "\n".join(lines)


def main():
    args = parse_args()
    analysis = load_analysis(args.analysis, args.require_real)
    report = inspect(analysis, args.min_score, args.jump_threshold)

    json_path = Path(args.json_out)
    json_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(render_markdown(report), encoding="utf-8")

    print(json.dumps({"ok": True, "out": str(out_path), "jsonOut": str(json_path), "model": report["summary"]["model"]}))


if __name__ == "__main__":
    main()
