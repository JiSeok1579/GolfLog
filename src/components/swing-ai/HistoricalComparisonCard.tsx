import { BarChart3 } from "lucide-react";
import { Card } from "../ui/Card";
import { Chip } from "../ui/Chip";
import type { SwingAnalysisResult, SwingPersonalizationReadiness } from "../../data/schema";
import { qualityForAnalysis } from "./AnalysisQualityBadge";

type Language = "ko" | "en";
type HistoricalRecord = NonNullable<NonNullable<SwingAnalysisResult["historicalComparison"]>["recordsUsed"]>[number];

function label(language: Language, ko: string, en: string) {
  return language === "ko" ? ko : en;
}

const metricLabels: Record<string, string> = {
  carryM: "Carry",
  headSpeed: "Head speed",
  launchAngle: "Launch",
  sideDeviationM: "Side",
  totalM: "Total",
};

function dateRangeLabel(comparison: NonNullable<SwingAnalysisResult["historicalComparison"]>, language: Language) {
  if (!comparison.dateRange?.start && !comparison.dateRange?.end) return label(language, "기록 날짜 없음", "No record dates");
  if (comparison.dateRange?.start === comparison.dateRange?.end) return comparison.dateRange.start;
  return `${comparison.dateRange?.start || "?"} - ${comparison.dateRange?.end || "?"}`;
}

function recordMetrics(record: HistoricalRecord) {
  return ["carryM", "totalM", "sideDeviationM", "headSpeed", "launchAngle"]
    .filter((key) => typeof record[key as keyof typeof record] === "number")
    .map((key) => {
      const value = record[key as keyof typeof record];
      const unit = key === "launchAngle" ? "deg" : key === "headSpeed" ? "" : "m";
      return `${metricLabels[key]} ${String(value)}${unit ? unit : ""}`;
    });
}

function readinessTone(status: SwingPersonalizationReadiness["status"]) {
  if (status === "sufficient") return "fairway";
  if (status === "limited") return "accent";
  return undefined;
}

export function HistoricalComparisonCard({ analysis, language }: { analysis: SwingAnalysisResult; language: Language }) {
  const quality = qualityForAnalysis(analysis);
  const comparison = analysis.historicalComparison;
  const unavailable = quality.isFallback;
  const readiness = comparison?.personalizationReadiness;

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
        <div className="historical-empty">
          {label(language, "fallback/예시 분석은 개인 기록과 비교하지 않습니다.", "Fallback/sample analysis is not compared against personal history.")}
          {readiness?.message ? <p>{readiness.message}</p> : null}
        </div>
      ) : comparison ? (
        <>
          <div className="historical-summary-row">
            <Chip tone={comparison.dataSufficiency === "sufficient" ? "fairway" : comparison.dataSufficiency === "limited" ? "accent" : undefined}>
              {comparison.baselineType}
            </Chip>
            {readiness ? <Chip tone={readinessTone(readiness.status)}>{readiness.status} readiness</Chip> : null}
            <Chip>{comparison.sampleSize} samples</Chip>
            <Chip>{dateRangeLabel(comparison, language)}</Chip>
            {typeof comparison.similarityScore === "number" ? <Chip tone="fairway">{comparison.similarityScore}% similarity</Chip> : null}
          </div>
          <p className="historical-summary">{comparison.summary}</p>
          {readiness ? (
            <div className="personalization-readiness-panel" data-status={readiness.status}>
              <div className="personalization-readiness-head">
                <span>{label(language, "개인화 준비도", "Personalization readiness")}</span>
                <strong>
                  {readiness.currentSampleSize}/{readiness.requiredForSufficient}
                </strong>
              </div>
              <p>{readiness.message}</p>
              <div className="personalization-readiness-grid">
                <div>
                  <span>{label(language, "Limited 기준", "Limited target")}</span>
                  <strong>{readiness.requiredForLimited}</strong>
                </div>
                <div>
                  <span>{label(language, "Sufficient 기준", "Sufficient target")}</span>
                  <strong>{readiness.requiredForSufficient}</strong>
                </div>
                <div>
                  <span>{label(language, "다음 단계까지", "To next level")}</span>
                  <strong>{readiness.missingCountForNextLevel}</strong>
                </div>
              </div>
            </div>
          ) : null}
          <details className="historical-detail-panel">
            <summary>{label(language, "비교 근거 보기", "View comparison details")}</summary>
            <div className="historical-detail-grid">
              <div>
                <span>{label(language, "샘플", "Sample")}</span>
                <strong>{comparison.sampleSize}</strong>
              </div>
              <div>
                <span>{label(language, "날짜 범위", "Date range")}</span>
                <strong>{dateRangeLabel(comparison, language)}</strong>
              </div>
              <div>
                <span>{label(language, "데이터 상태", "Data status")}</span>
                <strong>{comparison.dataSufficiency}</strong>
              </div>
            </div>
            <div className="historical-metrics-used">
              <span>{label(language, "사용한 지표", "Metrics used")}</span>
              <div>
                {(comparison.metricsUsed || []).length > 0 ? (
                  (comparison.metricsUsed || []).map((metric) => <Chip key={metric}>{metricLabels[metric] || metric}</Chip>)
                ) : (
                  <p>{label(language, "사용 가능한 같은 클럽 지표가 아직 부족합니다.", "Not enough same-club metrics are available yet.")}</p>
                )}
              </div>
            </div>
            {(comparison.recordsUsed || []).length > 0 ? (
              <div className="historical-record-list">
                <span>{label(language, "비교에 사용한 기록", "Records used")}</span>
                {comparison.recordsUsed?.map((record) => (
                  <div className="historical-record-row" key={record.id}>
                    <strong>{record.date || label(language, "날짜 없음", "No date")}</strong>
                    <small>{record.id}</small>
                    <p>{recordMetrics(record).join(" · ")}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="historical-empty">{label(language, "비교에 사용할 같은 클럽 기록이 아직 없습니다.", "No same-club records were available for comparison.")}</div>
            )}
          </details>
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
