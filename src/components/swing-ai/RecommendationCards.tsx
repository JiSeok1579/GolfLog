import { ArrowRight, ClipboardCheck } from "lucide-react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Chip } from "../ui/Chip";
import type { SwingAnalysisResult, SwingPhaseName, SwingRecommendation, SwingRecommendationFollowUp } from "../../data/schema";

type Language = "ko" | "en";
type RecommendationConfidenceLevel = NonNullable<SwingRecommendation["confidence"]>["level"];

function label(language: Language, ko: string, en: string) {
  return language === "ko" ? ko : en;
}

function formatMetricKey(value: string) {
  return value.replaceAll("_", " ");
}

function recommendationEvidence(recommendation: SwingRecommendation) {
  if (recommendation.evidenceMetrics && Object.keys(recommendation.evidenceMetrics).length > 0) {
    return Object.entries(recommendation.evidenceMetrics);
  }
  return [[recommendation.metric, recommendation.value]];
}

function confidenceTone(level: RecommendationConfidenceLevel) {
  if (level === "high") return "fairway";
  if (level === "low") return "accent";
  return undefined;
}

function recommendationConfidence(recommendation: SwingRecommendation, analysis: SwingAnalysisResult): NonNullable<SwingRecommendation["confidence"]> {
  if (recommendation.confidence) return recommendation.confidence;
  const quality = analysis.analysisQuality;
  if (quality?.isFallback) {
    return {
      level: "low",
      reason: "Fallback or sample analysis is not treated as real coaching evidence.",
      score: 0,
    };
  }
  return {
    level: "moderate",
    reason: "This older analysis does not include detailed recommendation confidence signals.",
    score: Math.round((quality?.poseConfidence ?? 0.5) * 100),
  };
}

function recommendationFollowUp(recommendation: SwingRecommendation, analysis: SwingAnalysisResult): SwingRecommendationFollowUp | null {
  if (analysis.analysisQuality?.isFallback) return null;
  return analysis.recommendationFollowUps?.find((item) => item.recommendationId === recommendation.id) || null;
}

export function RecommendationCards({
  analysis,
  language,
  onViewPhase,
  phaseLabel,
}: {
  analysis: SwingAnalysisResult;
  language: Language;
  onViewPhase: (phase: SwingPhaseName) => void;
  phaseLabel: (phase: string) => string;
}) {
  return (
    <Card className="swing-recommendation-card">
      <div className="card-title-row">
        <div>
          <p className="card-kicker">Recommendations</p>
          <h2>{label(language, "추천", "Recommendations")}</h2>
        </div>
        <Chip tone="accent">{analysis.recommendations.length}</Chip>
      </div>
      <div className="swing-recommendation-list">
        {analysis.recommendations.map((recommendation) => {
          const range = recommendation.overlayFrameRange;
          const confidence = recommendationConfidence(recommendation, analysis);
          const followUp = recommendationFollowUp(recommendation, analysis);
          return (
            <article data-severity={recommendation.severity} key={recommendation.id}>
              <div className="swing-recommendation-head">
                <span>
                  {phaseLabel(recommendation.phase)}
                  {range ? ` · ${range[0]}-${range[1]}f` : ""}
                </span>
                <div className="recommendation-badges">
                  <Chip tone={recommendation.severity === "risk" || recommendation.severity === "warning" ? "accent" : undefined}>
                    {recommendation.severity}
                  </Chip>
                  <Chip tone={confidenceTone(confidence.level)}>{confidence.level} · {confidence.score}% confidence</Chip>
                </div>
              </div>
              <h3>{recommendation.title}</h3>
              <div className="recommendation-evidence">
                {recommendationEvidence(recommendation).map(([key, value]) => (
                  <span key={key}>
                    {formatMetricKey(key)}: <strong>{String(value)}</strong>
                  </span>
                ))}
              </div>
              <div className="recommendation-coach-grid">
                <div>
                  <span>{label(language, "이유", "Why it matters")}</span>
                  <p>{recommendation.reason || recommendation.detail}</p>
                </div>
                <div>
                  <span>{label(language, "다음 동작", "What to do")}</span>
                  <p>{recommendation.suggestion || recommendation.detail}</p>
                </div>
                <div>
                  <span>{label(language, "드릴", "Drill")}</span>
                  <p>{recommendation.drill}</p>
                </div>
              </div>
              <p className="recommendation-confidence-note">{confidence.reason}</p>
              {analysis.analysisQuality?.isFallback ? (
                <p className="recommendation-follow-up-note">
                  {label(language, "예시/fallback 결과는 추천 추적 대상에서 제외됩니다.", "Fallback/sample recommendations are excluded from follow-up tracking.")}
                </p>
              ) : followUp ? (
                <div className="recommendation-follow-up-panel">
                  <span>{label(language, "후속 추적", "Follow-up scaffold")}</span>
                  <strong>{followUp.status}</strong>
                  <p>
                    {label(language, "향후 세션 연결", "Linked future sessions")}: {followUp.linkedFutureSessionIds.length}
                  </p>
                </div>
              ) : null}
              {recommendation.safetyNote ? <p className="recommendation-safety">{recommendation.safetyNote}</p> : null}
              <Button className="recommendation-phase-button" onClick={() => onViewPhase(recommendation.phase)} type="button" variant="secondary">
                <ClipboardCheck size={16} />
                {label(language, "구간 보기", "View phase")}
                <ArrowRight size={16} />
              </Button>
            </article>
          );
        })}
      </div>
    </Card>
  );
}
