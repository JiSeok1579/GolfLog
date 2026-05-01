function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 1) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function point(frame, name, minScore = 0.35) {
  const match = frame?.keypoints?.find((item) => item.name === name);
  return match && match.score >= minScore ? match : null;
}

function averagePoints(points) {
  const valid = points.filter(Boolean);
  if (valid.length === 0) return null;
  return {
    x: valid.reduce((sum, item) => sum + item.x, 0) / valid.length,
    y: valid.reduce((sum, item) => sum + item.y, 0) / valid.length,
  };
}

function distance(a, b) {
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleBetween(a, b, c) {
  if (!a || !b || !c) return 0;
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const abLength = Math.hypot(ab.x, ab.y);
  const cbLength = Math.hypot(cb.x, cb.y);
  if (abLength < 0.001 || cbLength < 0.001) return 0;
  const dot = ab.x * cb.x + ab.y * cb.y;
  return (Math.acos(clamp(dot / (abLength * cbLength), -1, 1)) * 180) / Math.PI;
}

function lineAngle(a, b) {
  if (!a || !b) return null;
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

function angleDelta(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  let diff = Math.abs(a - b) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}

function phaseFrame(frames, phases, phaseName) {
  const phase = phases.find((item) => item.name === phaseName);
  if (!phase || frames.length === 0) return frames[0] || null;
  const midpoint = (phase.startFrame + phase.endFrame) / 2;
  const inPhase = frames.filter((frame) => frame.frame >= phase.startFrame && frame.frame <= phase.endFrame);
  const candidates = inPhase.length > 0 ? inPhase : frames;
  return candidates.reduce((best, frame) => {
    return Math.abs(frame.frame - midpoint) < Math.abs(best.frame - midpoint) ? frame : best;
  }, candidates[0]);
}

function xRange(points) {
  const xs = points.filter(Boolean).map((item) => item.x);
  if (xs.length < 2) return 0;
  return Math.max(...xs) - Math.min(...xs);
}

function spineAngleProxy(frame) {
  const shoulderCenter =
    averagePoints([point(frame, "left_shoulder", 0.3), point(frame, "right_shoulder", 0.3)]) ||
    point(frame, "neck", 0.3);
  const pelvisCenter = averagePoints([point(frame, "left_hip", 0.3), point(frame, "right_hip", 0.3)]);
  if (!shoulderCenter || !pelvisCenter) return 0;
  const verticalLength = Math.max(pelvisCenter.y - shoulderCenter.y, 0.001);
  return Math.abs((Math.atan2(shoulderCenter.x - pelvisCenter.x, verticalLength) * 180) / Math.PI);
}

function lineChangeProxy(addressFrame, topFrame, leftName, rightName) {
  const startAngle = lineAngle(point(addressFrame, leftName, 0.3), point(addressFrame, rightName, 0.3));
  const topAngle = lineAngle(point(topFrame, leftName, 0.3), point(topFrame, rightName, 0.3));
  if (startAngle === null || topAngle === null) return 0;
  return angleDelta(startAngle, topAngle);
}

export function averagePoseConfidence(frames) {
  const scores = frames.flatMap((frame) => frame.keypoints.map((item) => item.score));
  if (scores.length === 0) return 0;
  return clamp(scores.reduce((sum, value) => sum + value, 0) / scores.length, 0, 1);
}

export function computeSwingProxyMetrics({ analysisQuality, frames, phases, tempoRatio }) {
  const addressFrame = phaseFrame(frames, phases, "address");
  const topFrame = phaseFrame(frames, phases, "backswing_top");
  const headSway = xRange(frames.map((frame) => point(frame, "head", 0.4)));
  const pelvisSway = xRange(
    frames.map((frame) => averagePoints([point(frame, "left_hip", 0.4), point(frame, "right_hip", 0.4)])),
  );
  const armAngle = angleBetween(
    point(topFrame, "left_shoulder", 0.3),
    point(topFrame, "left_elbow", 0.3),
    point(topFrame, "left_wrist", 0.3),
  );
  const shoulderTurn = lineChangeProxy(addressFrame, topFrame, "left_shoulder", "right_shoulder");
  const hipTurn = lineChangeProxy(addressFrame, topFrame, "left_hip", "right_hip");

  return {
    address_spine_angle_proxy: round(spineAngleProxy(addressFrame)),
    club_detection_rate: round(analysisQuality?.clubDetectionRate ?? 0, 3),
    head_sway_proxy: round(headSway),
    hip_turn_proxy: round(hipTurn),
    left_arm_bend_at_top_proxy: round(armAngle > 0 ? Math.abs(180 - armAngle) : 0),
    pelvis_sway_proxy: round(pelvisSway),
    pose_confidence: round(analysisQuality?.poseConfidence ?? averagePoseConfidence(frames), 3),
    shoulder_turn_proxy: round(shoulderTurn),
    tempo_ratio: round(tempoRatio, 2),
  };
}

export function clubHeadPathProxy(frames, impactPhase, dominantHand) {
  if (!impactPhase) return "neutral";
  const clubFrames = frames.filter((frame) => frame.club?.head && frame.club.score >= 0.25);
  if (clubFrames.length < 2) return "neutral";
  const impactMidpoint = (impactPhase.startFrame + impactPhase.endFrame) / 2;
  const impactFrame = clubFrames.reduce((best, frame) => {
    return Math.abs(frame.frame - impactMidpoint) < Math.abs(best.frame - impactMidpoint) ? frame : best;
  }, clubFrames[0]);
  const previousFrame = [...clubFrames].reverse().find((frame) => frame.frame < impactFrame.frame) || clubFrames[0];
  const handedSign = dominantHand === "left" ? -1 : 1;
  const horizontalMotion = distance(previousFrame.club?.head, impactFrame.club?.head)
    ? (impactFrame.club.head.x - previousFrame.club.head.x) * handedSign
    : 0;
  if (horizontalMotion > 4) return "in-to-out";
  if (horizontalMotion < -4) return "out-to-in";
  return "neutral";
}
