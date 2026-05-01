import { ArrowRight, ClipboardCheck } from "lucide-react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Chip } from "../ui/Chip";
import type { SwingAnalysisResult, SwingPhaseName, SwingRecommendation } from "../../data/schema";

type Language = "ko" | "en";

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
          return (
            <article data-severity={recommendation.severity} key={recommendation.id}>
              <div className="swing-recommendation-head">
                <span>
                  {phaseLabel(recommendation.phase)}
                  {range ? ` · ${range[0]}-${range[1]}f` : ""}
                </span>
                <Chip tone={recommendation.severity === "risk" || recommendation.severity === "warning" ? "accent" : undefined}>
                  {recommendation.severity}
                </Chip>
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
