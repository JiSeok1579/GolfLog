import { useState, type FormEvent } from "react";
import { Save } from "lucide-react";
import { LineChart } from "../components/charts/LineChart";
import { RadarChart } from "../components/charts/RadarChart";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Chip } from "../components/ui/Chip";
import { StatCard } from "../components/ui/StatCard";
import { text, useLanguage } from "../data/i18n";
import { cleanNumberInput } from "../data/numberInput";
import {
  bmi,
  diastolicTrend,
  healthRadarValues,
  healthScore,
  latestHealthEntry,
  recentHealthRows,
  sleepTrend,
  systolicTrend,
  weightTrend,
} from "../data/selectors";
import { newHealthEntrySchema } from "../data/schema";
import { useGolfLog } from "../data/store";
import { displayToKg, displayWeightInput, formatWeight, kgToDisplay } from "../data/units";

const radarAxes = ["BMI", "Sleep", "BP", "HR", "Activity", "Stability"];
const targetRadar = [8, 8, 8, 8, 8, 8];

function todayString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function optionalNumber(value: string) {
  if (!value.trim()) return undefined;
  return Number(value);
}

function optionalInteger(value: string) {
  const parsed = optionalNumber(value);
  return typeof parsed === "number" ? Math.round(parsed) : undefined;
}

function formatNumber(value: number | undefined, digits = 1) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

function formatWithUnit(value: number | undefined, unit: string, digits = 1) {
  const formatted = formatNumber(value, digits);
  return formatted === "-" ? formatted : `${formatted}${unit}`;
}

function formatBloodPressure(systolic: number | undefined, diastolic: number | undefined) {
  if (!systolic || !diastolic) return "-";
  return `${systolic}/${diastolic}`;
}

export function HealthPage() {
  const { addHealthEntry, data } = useGolfLog();
  const { language } = useLanguage();
  const weightUnit = data.profile.weightUnit;
  const latest = latestHealthEntry(data);
  const currentBmi = bmi(data);
  const score = healthScore(data);
  const healthRows = recentHealthRows(data, 10, language);
  const exampleWeight = displayWeightInput(latest?.weightKg ?? 74.2, weightUnit);
  const exampleSleepHours = latest?.sleepHours ? latest.sleepHours.toFixed(1) : "6.8";

  const [date, setDate] = useState(todayString);
  const [weight, setWeight] = useState("");
  const [sleepHours, setSleepHours] = useState("");
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [restingHr, setRestingHr] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSaved("");

    const entry = {
      date,
      weightKg: displayToKg(optionalNumber(weight), weightUnit),
      sleepHours: optionalNumber(sleepHours),
      systolic: optionalInteger(systolic),
      diastolic: optionalInteger(diastolic),
      restingHr: optionalInteger(restingHr),
    };
    const result = newHealthEntrySchema.safeParse(entry);
    if (!result.success) {
      setError(text(language, "건강 기록 입력값을 다시 확인해주세요.", "Check the health record values."));
      return;
    }

    const hasMetric = [result.data.weightKg, result.data.sleepHours, result.data.systolic, result.data.diastolic, result.data.restingHr].some(
      (value) => typeof value === "number",
    );
    if (!hasMetric) {
      setError(text(language, "체중, 수면, 혈압, 심박 중 최소 하나는 입력해주세요.", "Enter at least one value: weight, sleep, blood pressure, or heart rate."));
      return;
    }

    addHealthEntry(result.data);
    setSaved(text(language, `${date} 건강 기록을 저장했습니다.`, `Saved health record for ${date}.`));
  };

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Health</p>
          <h1>{text(language, "건강", "Health")}</h1>
          <p>{text(language, "체중, 수면, 혈압 흐름을 골프 연습 기록과 함께 관리합니다.", "Track weight, sleep, and blood pressure alongside golf practice records.")}</p>
        </div>
        <Chip tone="accent">{score}/100</Chip>
      </header>

      <div className="health-stat-grid">
        <StatCard delta="Health score" label="Readiness" note={text(language, "컨디션 기준", "Condition basis")} unit="/100" value={String(score)} />
        <StatCard delta="Latest" label="Weight" unit={weightUnit} value={formatNumber(kgToDisplay(latest?.weightKg, weightUnit))} />
        <StatCard delta="Profile BMI" label="BMI" value={formatNumber(currentBmi)} />
        <StatCard delta="Latest BP" label="Blood Pressure" unit="mmHg" value={formatBloodPressure(latest?.systolic, latest?.diastolic)} />
      </div>

      <div className="health-main-grid">
        <form className="form-stack" onSubmit={submit}>
          <Card>
            <div className="card-title-row">
              <div>
                <p className="card-kicker">Daily Input</p>
                <h2>{text(language, "오늘의 건강 기록", "Today's Health Record")}</h2>
              </div>
              <Chip>{date}</Chip>
            </div>
            <div className="form-grid">
              <label className="field">
                {text(language, "날짜", "Date")}
                <input onChange={(event) => setDate(event.target.value)} type="date" value={date} />
              </label>
              <label className="field">
                {text(language, "체중", "Weight")} {weightUnit}
                <input data-example={weight ? undefined : "true"} inputMode="decimal" onChange={(event) => setWeight(cleanNumberInput(event.target.value, { decimal: true }))} placeholder={exampleWeight} value={weight} />
              </label>
              <label className="field">
                {text(language, "수면 시간", "Sleep Hours")}
                <input data-example={sleepHours ? undefined : "true"} inputMode="decimal" onChange={(event) => setSleepHours(cleanNumberInput(event.target.value, { decimal: true }))} placeholder={exampleSleepHours} value={sleepHours} />
              </label>
              <label className="field">
                {text(language, "안정시 심박", "Resting HR")}
                <input inputMode="numeric" onChange={(event) => setRestingHr(cleanNumberInput(event.target.value))} placeholder="-" value={restingHr} />
              </label>
              <label className="field">
                {text(language, "수축기 혈압", "Systolic BP")}
                <input inputMode="numeric" onChange={(event) => setSystolic(cleanNumberInput(event.target.value))} placeholder="-" value={systolic} />
              </label>
              <label className="field">
                {text(language, "이완기 혈압", "Diastolic BP")}
                <input inputMode="numeric" onChange={(event) => setDiastolic(cleanNumberInput(event.target.value))} placeholder="-" value={diastolic} />
              </label>
            </div>
          </Card>

          {error ? <div className="form-error">{error}</div> : null}
          {saved ? <div className="form-success">{saved}</div> : null}

          <div className="save-row">
            <Button type="submit">
              <Save size={16} />
              {text(language, "건강 기록 저장", "Save Health Record")}
            </Button>
          </div>
        </form>

        <Card className="radar-card">
          <div className="card-title-row">
            <div>
              <p className="card-kicker">Readiness Radar</p>
              <h2>{text(language, "현재 상태 vs 목표", "Current vs Target")}</h2>
            </div>
            <Chip tone="accent">5 axes</Chip>
          </div>
          <RadarChart axes={radarAxes} compareValues={targetRadar} values={healthRadarValues(data)} />
          <div className="radar-legend">
            <span className="current">{text(language, "현재", "Current")}</span>
            <span className="compare">{text(language, "목표", "Target")}</span>
          </div>
        </Card>
      </div>

      <div className="health-chart-grid">
        <Card>
          <div className="card-title-row">
            <div>
              <p className="card-kicker">Weight</p>
              <h2>{text(language, "체중 추세", "Weight Trend")}</h2>
            </div>
            <Chip>{weightUnit}</Chip>
          </div>
          <LineChart values={weightTrend(data).map((value) => kgToDisplay(value, weightUnit) ?? 0)} />
        </Card>
        <Card>
          <div className="card-title-row">
            <div>
              <p className="card-kicker">Sleep</p>
              <h2>{text(language, "수면 추세", "Sleep Trend")}</h2>
            </div>
            <Chip>hours</Chip>
          </div>
          <LineChart markerLabel="best" values={sleepTrend(data)} />
        </Card>
        <Card>
          <div className="card-title-row">
            <div>
              <p className="card-kicker">Systolic</p>
              <h2>{text(language, "수축기 혈압", "Systolic BP")}</h2>
            </div>
            <Chip>mmHg</Chip>
          </div>
          <LineChart values={systolicTrend(data)} />
        </Card>
        <Card>
          <div className="card-title-row">
            <div>
              <p className="card-kicker">Diastolic</p>
              <h2>{text(language, "이완기 혈압", "Diastolic BP")}</h2>
            </div>
            <Chip>mmHg</Chip>
          </div>
          <LineChart values={diastolicTrend(data)} />
        </Card>
      </div>

      <Card className="health-table-card">
        <div className="card-title-row">
          <div>
            <p className="card-kicker">History</p>
            <h2>{text(language, "최근 건강 기록", "Recent Health Records")}</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{text(language, "날짜", "Date")}</th>
                <th>{text(language, "체중", "Weight")}</th>
                <th>BMI</th>
                <th>{text(language, "수면", "Sleep")}</th>
                <th>{text(language, "혈압", "BP")}</th>
                <th>{text(language, "안정시 심박", "Resting HR")}</th>
              </tr>
            </thead>
            <tbody>
              {healthRows.map((row) => {
                const rowBmi =
                  typeof row.weightKg === "number" ? row.weightKg / ((data.profile.heightCm / 100) * (data.profile.heightCm / 100)) : undefined;
                return (
                  <tr key={row.id}>
                    <td>{row.displayDate}</td>
                    <td>{formatWeight(row.weightKg, weightUnit)}</td>
                    <td>{formatNumber(rowBmi)}</td>
                    <td>{formatWithUnit(row.sleepHours, "h")}</td>
                    <td>{formatBloodPressure(row.systolic, row.diastolic)}</td>
                    <td>{row.restingHr ? `${row.restingHr}bpm` : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
