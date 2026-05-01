import { Target } from "lucide-react";
import { Card } from "../ui/Card";
import { Chip } from "../ui/Chip";
import type { SwingAnalysisResult } from "../../data/schema";
import { qualityForAnalysis, qualityState } from "./AnalysisQualityBadge";

type Language = "ko" | "en";

function label(language: Language, ko: string, en: string) {
  return language === "ko" ? ko : en;
}

export function CoachSummaryCard({ analysis, language }: { analysis: SwingAnalysisResult; language: Language }) {
  const quality = qualityForAnalysis(analysis);
  const state = qualityState(quality);
  const primaryRecommendation = analysis.recommendations.find((item) => item.severity === "risk" || item.severity === "warning") || analysis.recommendations[0];
  const scoreLabel = quality.isFallback ? "N/A" : analysis.scores.overall;

  return (
    <Card className="coach-summary-card">
      <div className="card-title-row">
        <div>
          <p className="card-kicker">AI Coach Report</p>
          <h2>{label(language, "개인 코치 요약", "Personal Coach Summary")}</h2>
        </div>
        <Target size={18} />
      </div>
      <div className="coach-summary-grid">
        <div className="coach-final-score" data-unavailable={quality.isFallback ? "true" : undefined}>
          <span>{label(language, "최종 점수", "Final Score")}</span>
          <strong>{scoreLabel}</strong>
          <small>{quality.isFallback ? label(language, "fallback/예시 분석", "fallback/sample analysis") : label(language, "2D proxy 기반", "2D proxy based")}</small>
        </div>
        <div className="coach-summary-detail">
          <div className="coach-summary-chips">
            <Chip tone={state === "fallback" || state === "poor" ? "accent" : "fairway"}>{state}</Chip>
            <Chip>{Math.round(quality.poseConfidence * 100)}% confidence</Chip>
            <Chip>{quality.clubDetectedFrames}/{quality.analyzedFrameCount} club frames</Chip>
          </div>
          <h3>{primaryRecommendation?.title || label(language, "추천 없음", "No recommendation")}</h3>
          <p>
            {quality.isFallback
              ? label(language, "이 결과는 실제 자세 진단이 아니므로 점수와 개인화 비교를 해석하지 않습니다.", "This result is not treated as a real posture diagnosis.")
              : primaryRecommendation?.reason || primaryRecommendation?.detail || label(language, "분석 결과를 확인하세요.", "Review the analysis result.")}
          </p>
        </div>
      </div>
    </Card>
  );
}
