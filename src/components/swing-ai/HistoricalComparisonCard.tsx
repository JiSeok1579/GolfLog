import { BarChart3 } from "lucide-react";
import { Card } from "../ui/Card";
import { Chip } from "../ui/Chip";
import type { SwingAnalysisResult } from "../../data/schema";
import { qualityForAnalysis } from "./AnalysisQualityBadge";

type Language = "ko" | "en";

function label(language: Language, ko: string, en: string) {
  return language === "ko" ? ko : en;
}

export function HistoricalComparisonCard({ analysis, language }: { analysis: SwingAnalysisResult; language: Language }) {
  const quality = qualityForAnalysis(analysis);
  const comparison = analysis.historicalComparison;
  const unavailable = quality.isFallback;

  return (
    <Card className="historical-comparison-card">
      <div className="card-title-row">
        <div>
          <p className="card-kicker">GolfLog History</p>
          <h2>{label(language, "개인 기록 비교", "Historical Comparison")}</h2>
        </div>
        <BarChart3 size={18} />
      </div>
      {unavailable ? (
        <div className="historical-empty">{label(language, "fallback/예시 분석은 개인 기록과 비교하지 않습니다.", "Fallback/sample analysis is not compared against personal history.")}</div>
      ) : comparison ? (
        <>
          <div className="historical-summary-row">
            <Chip tone={comparison.dataSufficiency === "sufficient" ? "fairway" : comparison.dataSufficiency === "limited" ? "accent" : undefined}>
              {comparison.baselineType}
            </Chip>
            <Chip>{comparison.sampleSize} samples</Chip>
            {typeof comparison.similarityScore === "number" ? <Chip tone="fairway">{comparison.similarityScore}% similarity</Chip> : null}
          </div>
          <p className="historical-summary">{comparison.summary}</p>
          <div className="historical-match-grid">
            <div>
              <span>{label(language, "일치/지원되는 부분", "Positive matches")}</span>
              {comparison.positiveMatches.length > 0 ? (
                <ul>
                  {comparison.positiveMatches.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p>{label(language, "아직 충분한 긍정 비교 항목이 없습니다.", "No positive comparison items yet.")}</p>
              )}
            </div>
            <div>
              <span>{label(language, "주의할 부분", "Negative matches")}</span>
              {comparison.negativeMatches.length > 0 ? (
                <ul>
                  {comparison.negativeMatches.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p>{label(language, "명확한 부정 비교 항목은 없습니다.", "No clear negative comparison items.")}</p>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="historical-empty">{label(language, "이전 분석 결과에는 개인 기록 비교가 저장되어 있지 않습니다.", "This older analysis does not include historical comparison.")}</div>
      )}
    </Card>
  );
}
