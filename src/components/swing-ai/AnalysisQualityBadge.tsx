import { AlertTriangle, CheckCircle2, Gauge } from "lucide-react";
import type { SwingAnalysisQuality, SwingAnalysisResult } from "../../data/schema";

type Language = "ko" | "en";
type QualityState = "good" | "moderate" | "poor" | "fallback";

function averagePoseConfidence(result: SwingAnalysisResult) {
  const scores = result.pose2dFrames.flatMap((frame) => frame.keypoints.map((point) => point.score));
  if (scores.length === 0) return 0;
  return scores.reduce((sum, value) => sum + value, 0) / scores.length;
}

export function qualityForAnalysis(result: SwingAnalysisResult): SwingAnalysisQuality {
  if (result.analysisQuality) return result.analysisQuality;
  const analyzedFrameCount = result.pose2dFrames.length;
  const clubDetectedFrames = result.pose2dFrames.filter((frame) => frame.club).length;
  return {
    analyzedFrameCount,
    clubDetectedFrames,
    clubDetectionRate: analyzedFrameCount > 0 ? clubDetectedFrames / analyzedFrameCount : 0,
    droppedFrames: 0,
    frameCount: Math.max(analyzedFrameCount, Math.round(result.video.durationSec * result.video.fps)),
    isFallback: false,
    model: "unknown",
    poseConfidence: averagePoseConfidence(result),
    runtime: "unknown",
  };
}

export function qualityState(quality: SwingAnalysisQuality): QualityState {
  if (quality.isFallback) return "fallback";
  if (quality.poseConfidence >= 0.7) return "good";
  if (quality.poseConfidence >= 0.45) return "moderate";
  return "poor";
}

function label(language: Language, ko: string, en: string) {
  return language === "ko" ? ko : en;
}

export function AnalysisQualityBadge({ analysis, language }: { analysis: SwingAnalysisResult; language: Language }) {
  const quality = qualityForAnalysis(analysis);
  const state = qualityState(quality);
  const confidence = Math.round(quality.poseConfidence * 100);
  const clubFrames = `${quality.clubDetectedFrames} / ${quality.analyzedFrameCount}`;
  const title =
    state === "fallback"
      ? label(language, "Fallback analysis", "Fallback analysis")
      : label(language, "실제 자세 분석", "Real pose analysis");
  const stateLabel = {
    fallback:
      quality.model === "mock-sample"
        ? label(language, "생성된 예시 데이터", "Generated sample data")
        : label(language, "Pose model unavailable", "Pose model unavailable"),
    good: `${confidence}% confidence`,
    moderate: `${confidence}% confidence`,
    poor: `${confidence}% confidence`,
  }[state];
  const Icon = state === "fallback" || state === "poor" ? AlertTriangle : state === "moderate" ? Gauge : CheckCircle2;

  return (
    <aside className="analysis-quality-badge" data-quality={state}>
      <div className="analysis-quality-heading">
        <Icon size={17} />
        <strong>
          {title} · {stateLabel}
        </strong>
      </div>
      <div className="analysis-quality-meta">
        <span>
          {label(language, "클럽 검출", "Club detected")} {clubFrames} {label(language, "프레임", "frames")}
        </span>
        <span>{quality.runtime} · {quality.model}</span>
      </div>
      {quality.warning ? <p>{quality.warning}</p> : null}
    </aside>
  );
}
