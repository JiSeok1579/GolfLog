import { computeCoachScores } from "./metrics.js";

const historicalMetricKeys = ["carryM", "totalM", "sideDeviationM", "headSpeed", "launchAngle"];

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function average(values) {
  const valid = values.map(numberOrNull).filter((value) => value !== null);
  if (valid.length === 0) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function roundScore(value) {
  return Math.round(Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)));
}

function sameClubShots(appData, club) {
  const sessions = new Map((appData?.sessions || []).map((session) => [session.id, session]));
  return (appData?.clubShots || [])
    .filter((shot) => shot.club === club)
    .map((shot) => ({
      ...shot,
      sessionDate: sessions.get(shot.sessionId)?.date || "",
    }))
    .filter((shot) => {
      return historicalMetricKeys.some((key) => numberOrNull(shot[key]) !== null);
    })
    .sort((a, b) => String(b.sessionDate).localeCompare(String(a.sessionDate)))
    .slice(0, 20);
}

function dataSufficiency(sampleSize) {
  if (sampleSize >= 8) return "sufficient";
  if (sampleSize >= 3) return "limited";
  return "insufficient";
}

function fieldCoverage(shots) {
  if (shots.length === 0) return 0;
  const coverage = historicalMetricKeys.map((field) => shots.filter((shot) => numberOrNull(shot[field]) !== null).length / shots.length);
  return average(coverage) || 0;
}

function metricAverage(shots, key, absolute = false) {
  const values = shots
    .map((shot) => numberOrNull(shot[key]))
    .filter((value) => value !== null)
    .map((value) => (absolute ? Math.abs(value) : value));
  return average(values);
}

function currentPathLabel(clubPath) {
  if (clubPath === "neutral") return "neutral";
  if (clubPath === "in-to-out") return "in-to-out";
  if (clubPath === "out-to-in") return "out-to-in";
  return "unknown";
}

function historicalMetricsUsed(shots) {
  return historicalMetricKeys.filter((key) => shots.some((shot) => numberOrNull(shot[key]) !== null));
}

function historicalDateRange(shots) {
  const dates = shots.map((shot) => shot.sessionDate).filter(Boolean).sort();
  if (dates.length === 0) return undefined;
  return {
    end: dates[dates.length - 1],
    start: dates[0],
  };
}

function historicalRecord(shot) {
  return historicalMetricKeys.reduce(
    (record, key) => {
      const value = numberOrNull(shot[key]);
      if (value !== null) record[key] = value;
      return record;
    },
    {
      date: shot.sessionDate || "",
      id: shot.id,
      sessionId: shot.sessionId,
    },
  );
}

function isClubPathOrImpactRecommendation(recommendation) {
  const text = [
    recommendation.id,
    recommendation.metric,
    recommendation.title,
    recommendation.detail,
    recommendation.reason,
    recommendation.suggestion,
    recommendation.value,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return recommendation.phase === "impact" || text.includes("club_path") || text.includes("club path") || text.includes("club") || text.includes("impact");
}

function recommendationConfidence(recommendation, analysisQuality) {
  const poseConfidence = numberOrNull(analysisQuality?.poseConfidence) ?? 0;
  const analyzedFrames = numberOrNull(analysisQuality?.analyzedFrameCount) ?? 0;
  const detectedFrames = numberOrNull(analysisQuality?.clubDetectedFrames) ?? 0;
  const clubDetectionRate = analyzedFrames > 0 ? detectedFrames / analyzedFrames : numberOrNull(analysisQuality?.clubDetectionRate) ?? 0;
  const isClubPathRelated = isClubPathOrImpactRecommendation(recommendation);

  if (analysisQuality?.isFallback) {
    return {
      level: "low",
      reason: "Fallback or sample analysis is not treated as real coaching evidence.",
      score: 0,
      signals: {
        analyzedFrames,
        clubDetectedFrames: detectedFrames,
        clubDetectionRate: Number(clubDetectionRate.toFixed(3)),
        poseConfidence: Number(poseConfidence.toFixed(3)),
      },
    };
  }

  let score = roundScore((poseConfidence * 0.72 + (isClubPathRelated ? clubDetectionRate : poseConfidence) * 0.28) * 100);
  let reason = `Pose confidence is ${(poseConfidence * 100).toFixed(0)}%.`;
  if (isClubPathRelated) {
    reason = `Pose confidence is ${(poseConfidence * 100).toFixed(0)}%; club detected in ${detectedFrames}/${analyzedFrames} analyzed frames.`;
    if (clubDetectionRate < 0.35) score = Math.min(score, 44);
    else if (clubDetectionRate < 0.55) score = Math.min(score, 62);
  }

  const level = score >= 75 ? "high" : score >= 50 ? "moderate" : "low";
  return {
    level,
    reason,
    score,
    signals: {
      analyzedFrames,
      clubDetectedFrames: detectedFrames,
      clubDetectionRate: Number(clubDetectionRate.toFixed(3)),
      poseConfidence: Number(poseConfidence.toFixed(3)),
    },
  };
}

function withRecommendationConfidence(recommendations, analysisQuality) {
  return (recommendations || []).map((recommendation) => ({
    ...recommendation,
    confidence: recommendation.confidence || recommendationConfidence(recommendation, analysisQuality),
  }));
}

function buildHistoricalSummary({ analysis, sampleSize, sufficiency }) {
  const club = analysis.input.club;
  if (analysis.analysisQuality?.isFallback) {
    return "Historical comparison is unavailable for fallback or generated sample analysis.";
  }
  if (sufficiency === "insufficient") {
    return `Compared with your recent ${club} records, this analysis has insufficient historical support. Add more same-club shots to personalize the recommendation.`;
  }
  if (sufficiency === "limited") {
    return `Compared with your recent ${club} records, this analysis has limited historical support from ${sampleSize} same-club shots. Use it as context, not a diagnosis.`;
  }
  return `Compared with your recent ${club} records, this analysis has enough same-club context for a provisional personal coaching comparison.`;
}

export function buildHistoricalComparison({ analysis, appData }) {
  const fallback = Boolean(analysis.analysisQuality?.isFallback);
  const shots = fallback ? [] : sameClubShots(appData, analysis.input.club);
  const sampleSize = shots.length;
  const sufficiency = fallback ? "insufficient" : dataSufficiency(sampleSize);
  const baselineType = sufficiency === "insufficient" ? "insufficient-data" : "same-club-recent";
  const positiveMatches = [];
  const negativeMatches = [];

  if (fallback) {
    return {
      baselineType,
      club: analysis.input.club,
      dataSufficiency: sufficiency,
      metricsUsed: [],
      negativeMatches: ["Fallback or generated sample analysis is not compared against personal history."],
      positiveMatches,
      recordsUsed: [],
      sampleSize,
      summary: buildHistoricalSummary({ analysis, sampleSize, sufficiency }),
    };
  }

  if (sampleSize === 0) {
    negativeMatches.push("No same-club shot records are available yet.");
  } else {
    const carryAvg = metricAverage(shots, "carryM");
    const totalAvg = metricAverage(shots, "totalM");
    const sideAvg = metricAverage(shots, "sideDeviationM", true);
    const headSpeedAvg = metricAverage(shots, "headSpeed");
    const launchAvg = metricAverage(shots, "launchAngle");

    if (carryAvg !== null) positiveMatches.push(`Recent ${analysis.input.club} carry average is ${carryAvg.toFixed(1)}m.`);
    if (totalAvg !== null) positiveMatches.push(`Recent ${analysis.input.club} total average is ${totalAvg.toFixed(1)}m.`);
    if (headSpeedAvg !== null) positiveMatches.push(`Recent head speed average is ${headSpeedAvg.toFixed(1)}.`);
    if (launchAvg !== null) positiveMatches.push(`Recent launch angle average is ${launchAvg.toFixed(1)}deg.`);

    if (sideAvg !== null && sideAvg <= 12 && analysis.features?.clubPath === "neutral") {
      positiveMatches.push("Current neutral club path proxy is consistent with relatively stable recent direction records.");
    }
    if (sideAvg !== null && sideAvg > 18) {
      negativeMatches.push(`Recent average side deviation is ${sideAvg.toFixed(1)}m, so direction consistency needs more attention.`);
    }
  }

  const bodyScores = analysis.bodyMovementScores || {};
  if (typeof bodyScores.headStability === "number" && bodyScores.headStability < 65) {
    negativeMatches.push("Head stability proxy is below the current coach target; compare this with future same-club direction records.");
  }
  if (typeof bodyScores.tempo === "number" && bodyScores.tempo >= 78) {
    positiveMatches.push("Tempo proxy is inside the current coach target range.");
  }
  if (analysis.features?.clubPath && analysis.features.clubPath !== "neutral") {
    negativeMatches.push(`Current club path proxy is ${currentPathLabel(analysis.features.clubPath)}; verify this against ball start direction before changing mechanics.`);
  }
  if (sampleSize > 0 && fieldCoverage(shots) < 0.35) {
    negativeMatches.push("Same-club records exist, but many shot fields are missing. Add carry, total, side deviation, head speed, and launch angle where possible.");
  }
  if (positiveMatches.length === 0 && sampleSize > 0) {
    positiveMatches.push("Same-club records are available for future personalization.");
  }

  const coverage = fieldCoverage(shots);
  const sideAvg = metricAverage(shots, "sideDeviationM", true);
  const directionScore = sideAvg === null ? 72 : roundScore(100 - Math.min(sideAvg * 3, 42));
  const similarityScore =
    sufficiency === "sufficient"
      ? roundScore(
          (analysis.scores.overall || 0) * 0.35 +
            (bodyScores.headStability || 0) * 0.25 +
            directionScore * 0.2 +
            (analysis.features?.clubPath === "neutral" ? 88 : 72) * 0.1 +
            coverage * 100 * 0.1,
        )
      : undefined;

  return {
    baselineType,
    club: analysis.input.club,
    dataSufficiency: sufficiency,
    ...(historicalDateRange(shots) ? { dateRange: historicalDateRange(shots) } : {}),
    metricsUsed: historicalMetricsUsed(shots),
    negativeMatches: negativeMatches.slice(0, 4),
    positiveMatches: positiveMatches.slice(0, 4),
    recordsUsed: shots.map(historicalRecord),
    sampleSize,
    ...(similarityScore !== undefined ? { similarityScore } : {}),
    summary: buildHistoricalSummary({ analysis, sampleSize, sufficiency }),
  };
}

export function withCoachReport(analysis, appData) {
  const coachScores = computeCoachScores({
    analysisQuality: analysis.analysisQuality,
    features: analysis.features,
    scores: analysis.scores,
  });
  const analysisWithScores = {
    ...analysis,
    ...coachScores,
  };
  const analysisWithRecommendations = {
    ...analysisWithScores,
    recommendations: withRecommendationConfidence(analysisWithScores.recommendations, analysisWithScores.analysisQuality),
  };
  return {
    ...analysisWithRecommendations,
    historicalComparison: buildHistoricalComparison({ analysis: analysisWithRecommendations, appData }),
  };
}
