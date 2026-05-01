import { Activity, ListChecks } from "lucide-react";
import { Card } from "../ui/Card";
import type { SwingAnalysisResult, SwingScoreEvidence } from "../../data/schema";
import { qualityForAnalysis } from "./AnalysisQualityBadge";

type Language = "ko" | "en";
type ScoreEvidenceItem = NonNullable<NonNullable<SwingScoreEvidence["phaseScores"]>[string]>;

const phaseRows = [
  ["address", "Address"],
  ["takeaway", "Takeaway"],
  ["backswingTop", "Top"],
  ["downswing", "Downswing"],
  ["impact", "Impact"],
  ["followThrough", "Follow"],
  ["finish", "Finish"],
] as const;

const bodyRows = [
  ["headStability", "Head Stability"],
  ["shoulderRotation", "Shoulder Rotation"],
  ["hipRotation", "Hip Rotation"],
  ["spineAngleMaintenance", "Spine Angle"],
  ["armPath", "Arm Path"],
  ["weightShift", "Weight Shift"],
  ["balance", "Balance"],
  ["tempo", "Tempo"],
] as const;

function label(language: Language, ko: string, en: string) {
  return language === "ko" ? ko : en;
}

function scoreValue(value: number | undefined, unavailable: boolean) {
  if (unavailable) return "N/A";
  return typeof value === "number" ? value : "--";
}

function inputValue(input: ScoreEvidenceItem["inputs"][number]) {
  const value = typeof input.value === "number" ? input.value.toLocaleString() : input.value;
  return `${value}${input.unit ? ` ${input.unit}` : ""}`;
}

function ScoreEvidenceDetails({
  evidence,
  language,
  unavailable,
}: {
  evidence?: ScoreEvidenceItem;
  language: Language;
  unavailable: boolean;
}) {
  if (unavailable) {
    return <p className="coach-score-evidence-empty">{label(language, "fallback/예시 분석에서는 점수 근거를 표시하지 않습니다.", "Score evidence is unavailable for fallback/sample analysis.")}</p>;
  }
  if (!evidence) {
    return <p className="coach-score-evidence-empty">{label(language, "이전 분석 결과에는 점수 근거가 저장되어 있지 않습니다.", "This older analysis does not include score evidence.")}</p>;
  }
  return (
    <div className="coach-score-evidence-body">
      <p>{evidence.formula}</p>
      <dl>
        {evidence.inputs.map((input) => (
          <div key={`${input.label}-${input.source || ""}`}>
            <dt>{input.label}</dt>
            <dd>
              <strong>{inputValue(input)}</strong>
              {input.source ? <small>{input.source}</small> : null}
            </dd>
          </div>
        ))}
      </dl>
      {evidence.note ? <p className="coach-score-evidence-note">{evidence.note}</p> : null}
    </div>
  );
}

function ScoreRow({
  evidence,
  labelText,
  unavailable,
  value,
  language,
}: {
  evidence?: ScoreEvidenceItem;
  labelText: string;
  unavailable: boolean;
  value?: number;
  language: Language;
}) {
  return (
    <details className="coach-score-item" data-unavailable={unavailable ? "true" : undefined}>
      <summary>
        <span>{labelText}</span>
        <strong>{scoreValue(value, unavailable)}</strong>
      </summary>
      <ScoreEvidenceDetails evidence={evidence} language={language} unavailable={unavailable} />
    </details>
  );
}

export function ScoreBreakdownGrid({ analysis, language }: { analysis: SwingAnalysisResult; language: Language }) {
  const quality = qualityForAnalysis(analysis);
  const unavailable = quality.isFallback;
  const missingPhaseScores = !analysis.phaseScores && !unavailable;
  const missingBodyScores = !analysis.bodyMovementScores && !unavailable;

  return (
    <div className="coach-score-breakdown">
      <Card>
        <div className="card-title-row">
          <div>
            <p className="card-kicker">Phase Scores</p>
            <h2>{label(language, "구간별 점수", "Phase Scores")}</h2>
          </div>
          <ListChecks size={18} />
        </div>
        <div className="coach-score-list">
          {phaseRows.map(([key, title]) => (
            <ScoreRow
              evidence={analysis.scoreEvidence?.phaseScores?.[key]}
              key={key}
              labelText={title}
              language={language}
              unavailable={unavailable}
              value={analysis.phaseScores?.[key]}
            />
          ))}
        </div>
        {missingPhaseScores ? <p className="coach-score-note">{label(language, "이전 분석 결과에는 구간별 점수가 저장되어 있지 않습니다.", "This older analysis does not include phase scores.")}</p> : null}
      </Card>

      <Card>
        <div className="card-title-row">
          <div>
            <p className="card-kicker">Movement Scores</p>
            <h2>{label(language, "몸 움직임 점수", "Body / Movement Scores")}</h2>
          </div>
          <Activity size={18} />
        </div>
        <div className="coach-score-list">
          {bodyRows.map(([key, title]) => (
            <ScoreRow
              evidence={analysis.scoreEvidence?.bodyMovementScores?.[key]}
              key={key}
              labelText={title}
              language={language}
              unavailable={unavailable}
              value={analysis.bodyMovementScores?.[key]}
            />
          ))}
        </div>
        <p className="coach-score-note">
          {unavailable
            ? label(language, "fallback/예시 분석에서는 진단 점수를 표시하지 않습니다.", "Diagnostic scores are unavailable for fallback/sample analysis.")
            : missingBodyScores
              ? label(language, "이전 분석 결과에는 몸 움직임 점수가 저장되어 있지 않습니다.", "This older analysis does not include movement scores.")
              : label(language, "단일 카메라 2D proxy 점수이며 정밀 생체역학 진단값이 아닙니다.", "Single-camera 2D proxy scores, not definitive biomechanics.")}
        </p>
      </Card>
    </div>
  );
}
