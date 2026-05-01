const allowedKeypoints = new Set([
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
]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function numberOr(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function pointToPercent(value, axisSize) {
  const numeric = numberOr(value, 0);
  if (numeric >= 0 && numeric <= 1) return clamp(numeric * 100, 0, 100);
  return clamp((numeric / Math.max(axisSize, 1)) * 100, 0, 100);
}

function normalizeKeypoints(rawKeypoints, width, height) {
  if (!rawKeypoints || typeof rawKeypoints !== "object") return [];

  return Object.entries(rawKeypoints)
    .filter(([name]) => allowedKeypoints.has(name))
    .map(([name, value]) => {
      const tuple = Array.isArray(value) ? value : [0, 0, 0];
      return {
        name,
        score: clamp(numberOr(tuple[2], 0), 0, 1),
        x: Number(pointToPercent(tuple[0], width).toFixed(2)),
        y: Number(pointToPercent(tuple[1], height).toFixed(2)),
      };
    });
}

function normalizeClubPoint(rawPoint, width, height) {
  if (!rawPoint || typeof rawPoint !== "object") return null;
  const x = Number(rawPoint.x);
  const y = Number(rawPoint.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x: Number(pointToPercent(x, width).toFixed(2)),
    y: Number(pointToPercent(y, height).toFixed(2)),
  };
}

function normalizeDetectedClub(rawClub, width, height) {
  if (!rawClub || typeof rawClub !== "object") return null;
  const grip = normalizeClubPoint(rawClub.grip, width, height);
  const head = normalizeClubPoint(rawClub.head, width, height);
  if (!grip || !head) return null;
  const score = clamp(numberOr(rawClub.score, 1), 0, 1);
  if (score < 0.55) return null;
  return {
    grip,
    head,
    score,
  };
}

function pointByName(keypoints, name, minScore = 0.2) {
  const point = keypoints.find((item) => item.name === name);
  return point && point.score >= minScore ? point : null;
}

function vectorLength(vector) {
  return Math.hypot(vector.x, vector.y);
}

function unitVector(vector, fallback = { x: 1, y: 0 }) {
  const length = vectorLength(vector);
  if (length < 0.001) return fallback;
  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

function blendVectors(primary, secondary, primaryWeight = 0.72) {
  const secondaryWeight = 1 - primaryWeight;
  return unitVector({
    x: primary.x * primaryWeight + secondary.x * secondaryWeight,
    y: primary.y * primaryWeight + secondary.y * secondaryWeight,
  }, primary);
}

function clubLengthPercent(club, shoulderWidth, handSpread) {
  const factors = {
    "4I": 1.08,
    "5I": 1.05,
    "6I": 1.02,
    "7I": 0.99,
    "8I": 0.96,
    "9I": 0.93,
    AW: 0.87,
    Driver: 1.28,
    Hybrid: 1.14,
    PW: 0.9,
    SW: 0.84,
    Wood: 1.2,
  };
  const factor = factors[club] || factors.Driver;
  const maxLength = club === "Driver" ? 30 : club === "Wood" ? 29 : club === "Hybrid" ? 28 : 26;
  return clamp(shoulderWidth * factor + handSpread * 0.35, 16, maxLength);
}

function swingDirection({ frameProgress, grip, handedSign, hipCenter, shoulderCenter }) {
  const bodyHeight = Math.max(distance(shoulderCenter, hipCenter), 12);
  const handHeightRatio = (grip.y - shoulderCenter.y) / bodyHeight;

  if (frameProgress >= 0.86 && handHeightRatio < 0.45) {
    return unitVector({ x: 0.78 * handedSign, y: -0.72 });
  }

  if (handHeightRatio <= 0.2 || (frameProgress < 0.58 && handHeightRatio < 0.65)) {
    return unitVector({ x: -0.88 * handedSign, y: -0.48 });
  }

  if (frameProgress >= 0.58 && frameProgress < 0.82) {
    const y = handHeightRatio > 0.72 ? 0.55 : -0.32;
    return unitVector({ x: 0.9 * handedSign, y });
  }

  return unitVector({ x: 0.78 * handedSign, y: 0.62 });
}

function virtualClubFromHands(keypoints, input = {}, frameProgress = 0) {
  const leftWrist = pointByName(keypoints, "left_wrist");
  const rightWrist = pointByName(keypoints, "right_wrist");
  if (!leftWrist || !rightWrist) return undefined;

  const grip = {
    x: Number(((leftWrist.x + rightWrist.x) / 2).toFixed(2)),
    y: Number(((leftWrist.y + rightWrist.y) / 2).toFixed(2)),
  };
  const leftShoulder = pointByName(keypoints, "left_shoulder");
  const rightShoulder = pointByName(keypoints, "right_shoulder");
  const leftHip = pointByName(keypoints, "left_hip");
  const rightHip = pointByName(keypoints, "right_hip");
  const shoulderCenter = averagePoints([leftShoulder, rightShoulder]) || pointByName(keypoints, "neck") || {
    x: grip.x,
    y: Math.max(grip.y - 25, 0),
  };
  const hipCenter = averagePoints([leftHip, rightHip]) || {
    x: shoulderCenter.x,
    y: Math.min(shoulderCenter.y + 24, 100),
  };
  const handedSign = input.dominantHand === "left" ? -1 : 1;
  const shoulderWidth = Math.max(distance(leftShoulder, rightShoulder), 14);
  const handSpread = distance(leftWrist, rightWrist);
  const armDirection = unitVector(
    {
      x: grip.x - shoulderCenter.x,
      y: grip.y - shoulderCenter.y,
    },
    { x: handedSign * 0.5, y: 0.86 },
  );
  const direction = blendVectors(
    swingDirection({ frameProgress, grip, handedSign, hipCenter, shoulderCenter }),
    armDirection,
    input.viewAngle === "face-on" ? 0.78 : 0.72,
  );
  const length = clubLengthPercent(input.club, shoulderWidth, handSpread);

  return {
    grip,
    head: {
      x: Number(clamp(grip.x + direction.x * length, 0, 100).toFixed(2)),
      y: Number(clamp(grip.y + direction.y * length, 0, 100).toFixed(2)),
    },
    score: Math.min(leftWrist.score, rightWrist.score, 0.62),
  };
}

function normalizeFrames(raw, width, height, input) {
  const frames = Array.isArray(raw.frames) ? raw.frames : [];
  const maxFrame = frames.reduce((best, frame) => Math.max(best, Math.round(numberOr(frame.frame, 0))), 0);
  return frames
    .map((frame) => {
      const keypoints = normalizeKeypoints(frame.keypoints, width, height);
      if (keypoints.length === 0) return null;
      const frameNumber = Math.max(0, Math.round(numberOr(frame.frame, 0)));
      const frameProgress = maxFrame > 0 ? clamp(frameNumber / maxFrame, 0, 1) : 0;
      const detectedClub = normalizeDetectedClub(frame.club, width, height);
      return {
        club: detectedClub || virtualClubFromHands(keypoints, input, frameProgress),
        frame: frameNumber,
        keypoints,
        timeSec: Number(numberOr(frame.time, 0).toFixed(3)),
      };
    })
    .filter(Boolean);
}

function keypoint(frame, name, minScore = 0.35) {
  const point = frame?.keypoints.find((item) => item.name === name);
  return point && point.score >= minScore ? point : null;
}

function averagePoints(points) {
  const valid = points.filter(Boolean);
  if (valid.length === 0) return null;
  return {
    x: valid.reduce((sum, point) => sum + point.x, 0) / valid.length,
    y: valid.reduce((sum, point) => sum + point.y, 0) / valid.length,
  };
}

function handCenter(frame) {
  return (
    averagePoints([keypoint(frame, "left_wrist"), keypoint(frame, "right_wrist")]) ||
    frame?.club?.grip ||
    null
  );
}

function hipCenter(frame) {
  return averagePoints([keypoint(frame, "left_hip"), keypoint(frame, "right_hip")]);
}

function clubHead(frame) {
  if (!frame?.club || frame.club.score < 0.25) return null;
  return frame.club.head;
}

function distance(a, b) {
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function frameMotion(previous, current) {
  const handMotion = distance(handCenter(previous), handCenter(current));
  const clubMotion = distance(clubHead(previous), clubHead(current));
  const hipMotion = distance(hipCenter(previous), hipCenter(current));
  return Math.max(handMotion, clubMotion * 0.7, hipMotion * 1.4);
}

function framesInRange(frames, startFrame, endFrame, pointSelector) {
  return frames.filter((frame) => {
    return frame.frame >= startFrame && frame.frame <= endFrame && (!pointSelector || pointSelector(frame));
  });
}

function estimateAddressEnd(frames, total) {
  const first = frames.find((frame) => handCenter(frame)) || frames[0];
  const firstHand = handCenter(first);
  const firstClub = clubHead(first);
  const limit = Math.round(total * 0.18);
  const fallback = Math.round(total * 0.1);

  for (let index = 1; index < frames.length; index += 1) {
    const frame = frames[index];
    if (frame.frame > limit) break;
    const handMove = distance(firstHand, handCenter(frame));
    const clubMove = distance(firstClub, clubHead(frame));
    if (Math.max(handMove, clubMove * 0.65) >= 8) {
      return clamp(frame.frame - 1, 0, limit);
    }
  }

  return clamp(fallback, 0, limit);
}

function estimateTopFrame(frames, total, addressEnd) {
  const fallback = Math.round(total * 0.42);
  const start = Math.max(addressEnd + 1, Math.round(total * 0.16));
  const end = Math.round(total * 0.6);
  const candidates = framesInRange(frames, start, end, handCenter);
  if (candidates.length === 0) return fallback;

  return candidates.reduce((best, frame) => {
    const hand = handCenter(frame);
    const bestHand = handCenter(best);
    if (!hand || !bestHand) return best;
    if (hand.y === bestHand.y) return frame.frame < best.frame ? frame : best;
    return hand.y < bestHand.y ? frame : best;
  }, candidates[0]).frame;
}

function estimateImpactFrame(frames, total, topFrame) {
  const fallback = Math.round(total * 0.65);
  const addressFrame = frames.find((frame) => handCenter(frame)) || frames[0];
  const addressHand = handCenter(addressFrame);
  const addressClub = clubHead(addressFrame);
  const start = Math.max(topFrame + 1, Math.round(total * 0.52));
  const end = Math.round(total * 0.82);
  const expected = Math.round(total * 0.67);
  const candidates = framesInRange(frames, start, end, handCenter);
  if (candidates.length === 0) return fallback;

  return candidates.reduce((best, frame) => {
    const hand = handCenter(frame);
    const club = clubHead(frame);
    const bestHand = handCenter(best);
    const bestClub = clubHead(best);
    const score =
      distance(hand, addressHand) +
      distance(club, addressClub) * 0.35 +
      Math.abs(frame.frame - expected) * 0.08;
    const bestScore =
      distance(bestHand, addressHand) +
      distance(bestClub, addressClub) * 0.35 +
      Math.abs(best.frame - expected) * 0.08;
    return score < bestScore ? frame : best;
  }, candidates[0]).frame;
}

function estimateFinishStart(frames, total, impactFrame) {
  const fallback = Math.round(total * 0.84);
  const start = Math.max(impactFrame + 1, Math.round(total * 0.78));
  const candidates = frames.filter((frame) => frame.frame >= start);

  for (let index = 1; index < candidates.length; index += 1) {
    const previous = candidates[index - 1];
    const current = candidates[index];
    if (frameMotion(previous, current) <= 2.3) return current.frame;
  }

  return fallback;
}

function repairPhaseRanges(ranges, total) {
  let cursor = 0;
  return ranges.map((range, index) => {
    if (index === ranges.length - 1) {
      return { ...range, startFrame: clamp(Math.max(cursor, range.startFrame), 0, total), endFrame: total };
    }

    const remaining = ranges.length - index - 1;
    const maxEnd = Math.max(cursor, total - remaining);
    const startFrame = clamp(Math.max(cursor, range.startFrame), 0, maxEnd);
    const endFrame = clamp(Math.max(startFrame, range.endFrame), startFrame, maxEnd);
    cursor = endFrame + 1;
    return { ...range, startFrame, endFrame };
  });
}

function phaseFrames(frames, durationFrame) {
  const maxFrame = frames.reduce((best, frame) => Math.max(best, frame.frame), 0);
  const total = Math.max(maxFrame, durationFrame, 1);
  const sortedFrames = [...frames].sort((a, b) => a.frame - b.frame);
  const minGap = Math.max(2, Math.round(total * 0.025));
  const topWindow = Math.max(2, Math.round(total * 0.025));
  const impactWindow = Math.max(2, Math.round(total * 0.018));

  const rawAddressEnd = estimateAddressEnd(sortedFrames, total);
  const addressEnd = clamp(rawAddressEnd, 0, Math.round(total * 0.18));
  const rawTopFrame = estimateTopFrame(sortedFrames, total, addressEnd);
  const topFrame = clamp(rawTopFrame, addressEnd + minGap * 2, Math.round(total * 0.62));
  const rawImpactFrame = estimateImpactFrame(sortedFrames, total, topFrame);
  const impactFrame = clamp(rawImpactFrame, topFrame + minGap * 2, Math.round(total * 0.84));
  const rawFinishStart = estimateFinishStart(sortedFrames, total, impactFrame);
  const finishStart = clamp(rawFinishStart, impactFrame + minGap * 2, total);

  return repairPhaseRanges(
    [
      { name: "address", startFrame: 0, endFrame: addressEnd },
      { name: "takeaway", startFrame: addressEnd + 1, endFrame: topFrame - topWindow - 1 },
      { name: "backswing_top", startFrame: topFrame - topWindow, endFrame: topFrame + topWindow },
      { name: "downswing", startFrame: topFrame + topWindow + 1, endFrame: impactFrame - impactWindow - 1 },
      { name: "impact", startFrame: impactFrame - impactWindow, endFrame: impactFrame + impactWindow },
      { name: "follow_through", startFrame: impactFrame + impactWindow + 1, endFrame: finishStart - 1 },
      { name: "finish", startFrame: finishStart, endFrame: total },
    ],
    total,
  );
}

function createPhases(frames, fps, durationSec) {
  const durationFrame = Math.round(Math.max(durationSec, 0) * Math.max(fps, 1));
  return phaseFrames(frames, durationFrame).map(({ name, startFrame, endFrame }) => ({
    endFrame,
    name,
    startFrame,
    timeSec: Number((startFrame / Math.max(fps, 1)).toFixed(3)),
  }));
}

function tempoRatioFromPhases(phases) {
  const address = phases.find((phase) => phase.name === "address");
  const top = phases.find((phase) => phase.name === "backswing_top");
  const impact = phases.find((phase) => phase.name === "impact");
  if (!address || !top || !impact) return 0;

  const backswingFrames = Math.max(top.endFrame - address.startFrame, 1);
  const downswingFrames = Math.max(impact.startFrame - top.endFrame, 1);
  return Number(clamp(backswingFrames / downswingFrames, 0.5, 5).toFixed(1));
}

function headSwayPercent(frames) {
  const headXs = frames
    .map((frame) => frame.keypoints.find((point) => point.name === "head"))
    .filter((point) => point && point.score >= 0.4)
    .map((point) => point.x);
  if (headXs.length < 2) return 0;
  return Math.max(...headXs) - Math.min(...headXs);
}

function averageConfidence(frames) {
  const scores = frames.flatMap((frame) => frame.keypoints.map((point) => point.score));
  if (scores.length === 0) return 0;
  return scores.reduce((sum, value) => sum + value, 0) / scores.length;
}

function createRecommendations(user, frames, features) {
  const confidence = averageConfidence(frames);
  const recommendations = [
    {
      detail: `${user.name}님의 영상에서 추정한 머리 좌우 이동은 화면 폭 기준 ${features.headSwayCm.toFixed(1)}%입니다. 실제 거리 환산 전까지는 상대 지표로 해석하세요.`,
      drill: "정면 또는 후방 카메라를 고정하고 하프스윙에서 머리 기준선을 유지하는 연습을 진행하세요.",
      id: "pose-head-stability",
      metric: "head_sway_proxy",
      phase: "backswing_top",
      severity: features.headSwayCm > 8 ? "warning" : "info",
      title: "백스윙 축 이동을 확인하세요",
      value: `${features.headSwayCm.toFixed(1)}%`,
    },
    {
      detail: `현재 keypoint 평균 신뢰도는 ${(confidence * 100).toFixed(0)}%입니다. 조명, 카메라 고정, 전신 프레임이 안정될수록 분석 품질이 올라갑니다.`,
      drill: "발끝부터 머리까지 프레임 안에 넣고 카메라를 흔들리지 않게 고정한 뒤 다시 촬영하세요.",
      id: "pose-capture-quality",
      metric: "pose_confidence",
      phase: "address",
      severity: confidence < 0.55 ? "warning" : "info",
      title: "촬영 품질을 기준화하세요",
      value: `${(confidence * 100).toFixed(0)}%`,
    },
  ];

  return recommendations;
}

export function normalizeWorkerResult({ analysisId, createdAt, input, raw, user }) {
  const fps = Math.max(numberOr(raw.fps, 30), 1);
  const width = Math.max(Math.round(numberOr(raw.width, 1280)), 1);
  const height = Math.max(Math.round(numberOr(raw.height, 720)), 1);
  const pose2dFrames = normalizeFrames(raw, width, height, input);
  const durationSec = Math.max(numberOr(raw.durationSec, 0), pose2dFrames.at(-1)?.timeSec || 1);
  const confidence = averageConfidence(pose2dFrames);
  const headSway = headSwayPercent(pose2dFrames);
  const overall = Math.round(clamp(72 + confidence * 20 - Math.min(headSway, 12), 45, 96));
  const phases = createPhases(pose2dFrames, fps, durationSec);
  const features = {
    clubPath: "neutral",
    headSwayCm: Number(headSway.toFixed(1)),
    hipTurnDeg: 0,
    pelvisSwayCm: 0,
    shoulderTurnDeg: 0,
    spineAngleDeg: 0,
    tempoRatio: tempoRatioFromPhases(phases),
    xFactorDeg: 0,
  };

  return {
    createdAt,
    features,
    id: analysisId,
    input: {
      club: input.club,
      dominantHand: input.dominantHand,
      videoName: input.videoName,
      viewAngle: input.viewAngle,
    },
    phases,
    pose2dFrames,
    recommendations: createRecommendations(user, pose2dFrames, features),
    scores: {
      backswing: Math.round(clamp(overall - 3, 0, 100)),
      balance: Math.round(clamp(overall + 2, 0, 100)),
      impact: Math.round(clamp(overall - 6, 0, 100)),
      overall,
      setup: Math.round(clamp(overall + 4, 0, 100)),
    },
    status: "completed",
    video: {
      durationSec: Number(durationSec.toFixed(3)),
      fps,
      height,
      width,
    },
  };
}
