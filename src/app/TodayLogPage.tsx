import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Save } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Chip } from "../components/ui/Chip";
import { cleanNumberInput } from "../data/numberInput";
import { newSessionSchema, type SessionType } from "../data/schema";
import { useGolfLog } from "../data/store";

const sessionTypes: Array<{ value: SessionType; label: string }> = [
  { value: "range", label: "연습장" },
  { value: "screen", label: "스크린" },
  { value: "round", label: "라운드" },
  { value: "practice", label: "개인연습" },
  { value: "lesson", label: "레슨" },
];

const typeLabel: Record<SessionType, string> = {
  range: "연습장",
  screen: "스크린",
  round: "라운드",
  practice: "개인연습",
  lesson: "레슨",
};

function todayString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function optionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function ScorePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="score-field">
      <span>{label}</span>
      <div role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map((score) => (
          <button className={score <= value ? "on" : ""} key={score} onClick={() => onChange(score)} type="button">
            {score}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TodayLogPage() {
  const navigate = useNavigate();
  const { addSessionWithShots } = useGolfLog();
  const [date, setDate] = useState(todayString);
  const [type, setType] = useState<SessionType>("range");
  const [startTime, setStartTime] = useState("14:30");
  const [durationMinutes, setDurationMinutes] = useState("90");
  const [location, setLocation] = useState("");
  const [ballsHit, setBallsHit] = useState("120");
  const [condition, setCondition] = useState(3);
  const [focus, setFocus] = useState(3);
  const [feel, setFeel] = useState(3);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const session = {
      date,
      type,
      startTime: startTime || undefined,
      durationMinutes: optionalNumber(durationMinutes),
      location: location.trim() || undefined,
      ballsHit: optionalNumber(ballsHit),
      condition,
      focus,
      feel,
      notes: notes.trim() || undefined,
    };

    const sessionResult = newSessionSchema.safeParse(session);
    if (!sessionResult.success) {
      setError("운동 정보 입력값을 다시 확인해주세요.");
      return;
    }

    addSessionWithShots(sessionResult.data, []);
    navigate("/");
  };

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Log Session</p>
          <h1>오늘의 기록</h1>
          <p>운동 정보, 컨디션, 메모를 저장하면 대시보드와 캘린더에 바로 반영됩니다.</p>
        </div>
        <Chip tone="accent">{typeLabel[type]}</Chip>
      </header>

      <form className="form-stack log-main-stack" onSubmit={submit}>
        <Card>
          <div className="card-title-row">
            <div>
              <p className="card-kicker">Session</p>
              <h2>운동 정보</h2>
            </div>
          </div>
          <div className="form-grid">
            <label className="field">
              날짜
              <input onChange={(event) => setDate(event.target.value)} type="date" value={date} />
            </label>
            <label className="field">
              유형
              <select onChange={(event) => setType(event.target.value as SessionType)} value={type}>
                {sessionTypes.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              시작 시간
              <input onChange={(event) => setStartTime(event.target.value)} type="time" value={startTime} />
            </label>
            <label className="field">
              총 시간 (분)
              <input inputMode="numeric" onChange={(event) => setDurationMinutes(cleanNumberInput(event.target.value))} value={durationMinutes} />
            </label>
            <label className="field">
              장소
              <input onChange={(event) => setLocation(event.target.value)} placeholder="GDR 강남점" value={location} />
            </label>
            <label className="field">
              타구 수
              <input inputMode="numeric" onChange={(event) => setBallsHit(cleanNumberInput(event.target.value))} value={ballsHit} />
            </label>
          </div>
        </Card>

        <Card>
          <div className="card-title-row">
            <div>
              <p className="card-kicker">Condition</p>
              <h2>컨디션 · 1~5점</h2>
            </div>
          </div>
          <div className="score-grid">
            <ScorePicker label="컨디션" onChange={setCondition} value={condition} />
            <ScorePicker label="집중도" onChange={setFocus} value={focus} />
            <ScorePicker label="체감" onChange={setFeel} value={feel} />
          </div>
        </Card>

        <Card>
          <div className="card-title-row">
            <div>
              <p className="card-kicker">Notes</p>
              <h2>메모</h2>
            </div>
          </div>
          <label className="field">
            오늘의 느낌, 개선할 점
            <textarea onChange={(event) => setNotes(event.target.value)} rows={5} value={notes} />
          </label>
        </Card>

        {error ? <div className="form-error">{error}</div> : null}

        <div className="save-row">
          <Button onClick={() => navigate(-1)} type="button" variant="secondary">
            취소
          </Button>
          <Button type="submit">
            <Save size={16} />
            저장
          </Button>
        </div>
      </form>
    </section>
  );
}
