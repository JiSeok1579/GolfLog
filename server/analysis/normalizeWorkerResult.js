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

function virtualClubFromHands(keypoints) {
  const leftWrist = keypoints.find((point) => point.name === "left_wrist");
  const rightWrist = keypoints.find((point) => point.name === "right_wrist");
  if (!leftWrist || !rightWrist) return undefined;

  const grip = {
    x: Number(((leftWrist.x + rightWrist.x) / 2).toFixed(2)),
    y: Number(((leftWrist.y + rightWrist.y) / 2).toFixed(2)),
  };
  return {
    grip,
    head: {
      x: Number(clamp(grip.x + 16, 0, 100).toFixed(2)),
      y: Number(clamp(grip.y + 14, 0, 100).toFixed(2)),
    },
    score: Math.min(leftWrist.score, rightWrist.score, 0.52),
  };
}

function normalizeFrames(raw, width, height) {
  const frames = Array.isArray(raw.frames) ? raw.frames : [];
  return frames
    .map((frame) => {
      const keypoints = normalizeKeypoints(frame.keypoints, width, height);
      if (keypoints.length === 0) return null;
      return {
        club: frame.club || virtualClubFromHands(keypoints),
        frame: Math.max(0, Math.round(numberOr(frame.frame, 0))),
        keypoints,
        timeSec: Number(numberOr(frame.time, 0).toFixed(3)),
      };
    })
    .filter(Boolean);
}

function phaseFrames(maxFrame) {
  const total = Math.max(maxFrame, 120);
  return {
    address: [0, Math.round(total * 0.1)],
    takeaway: [Math.round(total * 0.1) + 1, Math.round(total * 0.25)],
    backswing_top: [Math.round(total * 0.25) + 1, Math.round(total * 0.42)],
    downswing: [Math.round(total * 0.42) + 1, Math.round(total * 0.62)],
    impact: [Math.round(total * 0.62) + 1, Math.round(total * 0.68)],
    follow_through: [Math.round(total * 0.68) + 1, Math.round(total * 0.84)],
    finish: [Math.round(total * 0.84) + 1, total],
  };
}

function createPhases(frames, fps) {
  const maxFrame = frames.reduce((best, frame) => Math.max(best, frame.frame), 0);
  return Object.entries(phaseFrames(maxFrame)).map(([name, [startFrame, endFrame]]) => ({
    endFrame,
    name,
    startFrame,
    timeSec: Number((startFrame / Math.max(fps, 1)).toFixed(3)),
  }));
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
  const pose2dFrames = normalizeFrames(raw, width, height);
  const durationSec = Math.max(numberOr(raw.durationSec, 0), pose2dFrames.at(-1)?.timeSec || 1);
  const confidence = averageConfidence(pose2dFrames);
  const headSway = headSwayPercent(pose2dFrames);
  const overall = Math.round(clamp(72 + confidence * 20 - Math.min(headSway, 12), 45, 96));
  const features = {
    clubPath: "neutral",
    headSwayCm: Number(headSway.toFixed(1)),
    hipTurnDeg: 0,
    pelvisSwayCm: 0,
    shoulderTurnDeg: 0,
    spineAngleDeg: 0,
    tempoRatio: 0,
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
    phases: createPhases(pose2dFrames, fps),
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
