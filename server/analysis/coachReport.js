import { computeCoachScores } from "./metrics.js";

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
      return ["carryM", "totalM", "sideDeviationM", "headSpeed", "launchAngle"].some((key) => numberOrNull(shot[key]) !== null);
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
  const fields = ["carryM", "totalM", "sideDeviationM", "headSpeed", "launchAngle"];
  if (shots.length === 0) return 0;
  const coverage = fields.map((field) => shots.filter((shot) => numberOrNull(shot[field]) !== null).length / shots.length);
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
      negativeMatches: ["Fallback or generated sample analysis is not compared against personal history."],
      positiveMatches,
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
    negativeMatches: negativeMatches.slice(0, 4),
    positiveMatches: positiveMatches.slice(0, 4),
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
  return {
    ...analysisWithScores,
    historicalComparison: buildHistoricalComparison({ analysis: analysisWithScores, appData }),
  };
}
