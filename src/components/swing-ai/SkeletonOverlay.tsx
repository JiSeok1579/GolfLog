import type { SwingPose2DFrame } from "../../data/schema";

type SwingKeypointName = SwingPose2DFrame["keypoints"][number]["name"];

const skeletonSegments: Array<[SwingKeypointName, SwingKeypointName]> = [
  ["head", "neck"],
  ["left_shoulder", "right_shoulder"],
  ["left_shoulder", "left_elbow"],
  ["left_elbow", "left_wrist"],
  ["right_shoulder", "right_elbow"],
  ["right_elbow", "right_wrist"],
  ["left_shoulder", "left_hip"],
  ["right_shoulder", "right_hip"],
  ["left_hip", "right_hip"],
  ["left_hip", "left_knee"],
  ["left_knee", "left_ankle"],
  ["right_hip", "right_knee"],
  ["right_knee", "right_ankle"],
];

function keypointMap(frame: SwingPose2DFrame) {
  return new Map(frame.keypoints.map((point) => [point.name, point]));
}

function averageScore(frame: SwingPose2DFrame) {
  if (frame.keypoints.length === 0) return 0;
  return frame.keypoints.reduce((sum, point) => sum + point.score, 0) / frame.keypoints.length;
}

function opacityFor(score: number) {
  if (score < 0.4) return 0;
  if (score < 0.7) return 0.42;
  return 0.9;
}

export function SkeletonOverlay({ frame }: { frame: SwingPose2DFrame }) {
  const points = keypointMap(frame);
  const lowConfidence = averageScore(frame) < 0.55;

  return (
    <>
      <svg className="swing-skeleton-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {skeletonSegments.map(([from, to]) => {
          const a = points.get(from);
          const b = points.get(to);
          if (!a || !b || a.score < 0.4 || b.score < 0.4) return null;
          return (
            <line
              className="swing-skeleton-line"
              key={`${from}-${to}`}
              opacity={Math.min(opacityFor(a.score), opacityFor(b.score))}
              x1={a.x}
              x2={b.x}
              y1={a.y}
              y2={b.y}
            />
          );
        })}
        {frame.club ? (
          <line
            className="swing-club-line"
            opacity={frame.club.score < 0.7 ? 0.48 : 0.9}
            x1={frame.club.grip.x}
            x2={frame.club.head.x}
            y1={frame.club.grip.y}
            y2={frame.club.head.y}
          />
        ) : null}
        {frame.keypoints.map((point) =>
          point.score >= 0.4 ? (
            <circle className="swing-skeleton-dot" cx={point.x} cy={point.y} key={point.name} opacity={opacityFor(point.score)} r="1.25" />
          ) : null,
        )}
        {frame.club ? <circle className="swing-club-head" cx={frame.club.head.x} cy={frame.club.head.y} opacity={frame.club.score < 0.7 ? 0.55 : 1} r="1.8" /> : null}
      </svg>
      {lowConfidence ? <span className="swing-low-confidence-label">Low pose confidence</span> : null}
    </>
  );
}
