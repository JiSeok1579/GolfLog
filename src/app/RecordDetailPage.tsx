import { useEffect, useMemo, useState, type FormEvent } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Chip } from "../components/ui/Chip";
import { SCREEN_GOLF_LOCATION } from "../data/constants";
import { CLUBS, clubLabel } from "../data/defaultData";
import { sessionTypeLabel, text, useLanguage } from "../data/i18n";
import { cleanNumberInput } from "../data/numberInput";
import { formatSessionDate, sessionBestCarry, sessionDetail } from "../data/selectors";
import { newClubShotSchema, newSessionSchema, type Club, type NewClubShotInput, type SessionType } from "../data/schema";
import { useGolfLog } from "../data/store";
import { displayDistanceInput, displayToMeters, formatDistance } from "../data/units";

type ShotDraft = {
  club: Club;
  carryM: string;
  totalM: string;
  ballSpeed: string;
  headSpeed: string;
  launchAngle: string;
  backspin: string;
  sidespin: string;
  sideDeviationM: string;
};

const sessionTypes: SessionType[] = ["range", "screen", "round", "practice", "lesson"];

function optionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionalInteger(value: string) {
  const parsed = optionalNumber(value);
  return typeof parsed === "number" ? Math.round(parsed) : undefined;
}

function fieldValue(value: number | undefined) {
  if (typeof value !== "number") return "";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function emptyShotDrafts(): ShotDraft[] {
  return CLUBS.map((club) => ({
    club,
    carryM: "",
    totalM: "",
    ballSpeed: "",
    headSpeed: "",
    launchAngle: "",
    backspin: "",
    sidespin: "",
    sideDeviationM: "",
  }));
}

function hasShotValue(shot: ShotDraft) {
  return [
    shot.carryM,
    shot.totalM,
    shot.ballSpeed,
    shot.headSpeed,
    shot.launchAngle,
    shot.backspin,
    shot.sidespin,
    shot.sideDeviationM,
  ].some((value) => typeof optionalNumber(value) === "number");
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

export function RecordDetailPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { data, deleteSession, updateSessionWithShots } = useGolfLog();
  const { language } = useLanguage();
  const distanceUnit = data.profile.distanceUnit;
  const detail = sessionId ? sessionDetail(data, sessionId) : undefined;
  const bestCarry = sessionId ? sessionBestCarry(data, sessionId) : undefined;

  const [date, setDate] = useState("");
  const [type, setType] = useState<SessionType>("range");
  const [startTime, setStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [location, setLocation] = useState("");
  const [ballsHit, setBallsHit] = useState("");
  const [condition, setCondition] = useState(3);
  const [focus, setFocus] = useState(3);
  const [feel, setFeel] = useState(3);
  const [notes, setNotes] = useState("");
  const [shotDrafts, setShotDrafts] = useState<ShotDraft[]>(emptyShotDrafts);
  const [screenMetricClub, setScreenMetricClub] = useState<Club>("Driver");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    if (!detail) return;

    const shotsByClub = new Map(detail.shots.map((shot) => [shot.club, shot]));
    setDate(detail.session.date);
    setType(detail.session.type);
    setStartTime(detail.session.startTime ?? "");
    setDurationMinutes(detail.session.durationMinutes ? String(detail.session.durationMinutes) : "");
    setLocation(detail.session.location ?? (detail.session.type === "screen" ? SCREEN_GOLF_LOCATION : ""));
    setBallsHit(detail.session.ballsHit ? String(detail.session.ballsHit) : "");
    setCondition(detail.session.condition ?? 3);
    setFocus(detail.session.focus ?? 3);
    setFeel(detail.session.feel ?? 3);
    setNotes(detail.session.notes ?? "");
    setScreenMetricClub(detail.shots[0]?.club ?? "Driver");
    setShotDrafts(
      CLUBS.map((club) => {
        const shot = shotsByClub.get(club);
        return {
          club,
          carryM: displayDistanceInput(shot?.carryM, distanceUnit),
          totalM: displayDistanceInput(shot?.totalM, distanceUnit),
          ballSpeed: fieldValue(shot?.ballSpeed),
          headSpeed: fieldValue(shot?.headSpeed),
          launchAngle: fieldValue(shot?.launchAngle),
          backspin: fieldValue(shot?.backspin),
          sidespin: fieldValue(shot?.sidespin),
          sideDeviationM: displayDistanceInput(shot?.sideDeviationM, distanceUnit, 1),
        };
      }),
    );
    setError("");
    setSaved("");
  }, [distanceUnit, sessionId]);

  const recordedShotDrafts = useMemo(() => shotDrafts.filter(hasShotValue), [shotDrafts]);
  const shotCount = recordedShotDrafts.length;

  const updateShot = (club: Club, key: keyof Omit<ShotDraft, "club">, value: string) => {
    setError("");
    setSaved("");
    setShotDrafts((current) => current.map((shot) => (shot.club === club ? { ...shot, [key]: value } : shot)));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail) return;
    setError("");
    setSaved("");

    const session = {
      date,
      type,
      startTime: startTime || undefined,
      durationMinutes: optionalInteger(durationMinutes),
      location: location.trim() || (type === "screen" ? SCREEN_GOLF_LOCATION : undefined),
      ballsHit: optionalInteger(ballsHit),
      condition,
      focus,
      feel,
      notes: notes.trim() || undefined,
    };
    const sessionResult = newSessionSchema.safeParse(session);
    if (!sessionResult.success) {
      setError(text(language, "운동 정보 입력값을 다시 확인해주세요.", "Check the session values."));
      return;
    }

    const shots: NewClubShotInput[] = shotDrafts
      .filter(hasShotValue)
      .map((shot) => ({
        club: shot.club,
        carryM: displayToMeters(optionalNumber(shot.carryM), distanceUnit),
        totalM: displayToMeters(optionalNumber(shot.totalM), distanceUnit),
        ballSpeed: optionalNumber(shot.ballSpeed),
        headSpeed: optionalNumber(shot.headSpeed),
        launchAngle: optionalNumber(shot.launchAngle),
        backspin: optionalNumber(shot.backspin),
        sidespin: optionalNumber(shot.sidespin),
        sideDeviationM: displayToMeters(optionalNumber(shot.sideDeviationM), distanceUnit),
      }));

    const invalidShot = shots.find((shot) => !newClubShotSchema.safeParse(shot).success);
    if (invalidShot) {
      setError(text(language, `${clubLabel(invalidShot.club, language)} 기록값을 다시 확인해주세요.`, `Check the ${clubLabel(invalidShot.club, language)} record values.`));
      return;
    }

    const screenShotMissingCarry = sessionResult.data.type === "screen" ? shots.find((shot) => typeof shot.carryM !== "number") : undefined;
    if (screenShotMissingCarry) {
      setError(text(language, `${clubLabel(screenShotMissingCarry.club, language)} 스크린 기록은 비거리 반영을 위해 캐리 값이 필요합니다.`, `${clubLabel(screenShotMissingCarry.club, language)} screen records need carry distance for Distance tab sync.`));
      return;
    }

    updateSessionWithShots(detail.session.id, sessionResult.data, shots);
    setSaved(text(language, "기록을 저장했습니다.", "Record saved."));
  };

  const removeSession = () => {
    if (!detail) return;
    if (!window.confirm(text(language, `${formatSessionDate(detail.session.date, language)} 기록을 삭제할까요?`, `Delete the ${formatSessionDate(detail.session.date, language)} record?`))) return;
    deleteSession(detail.session.id);
    navigate("/calendar");
  };

  if (!detail) {
    return (
      <section className="page">
        <header className="page-head">
          <div>
            <p className="eyebrow">Record Detail</p>
            <h1>{text(language, "기록을 찾을 수 없습니다", "Record Not Found")}</h1>
            <p>{text(language, "삭제되었거나 저장소에 없는 세션입니다.", "This session was deleted or is not in storage.")}</p>
          </div>
          <NavLink className="button button-secondary" to="/calendar">
            <ArrowLeft size={16} />
            {text(language, "캘린더", "Calendar")}
          </NavLink>
        </header>
      </section>
    );
  }

  const hasClubRecords = detail.shots.length > 0;
  const screenMetricShot = recordedShotDrafts.find((shot) => shot.club === screenMetricClub) ?? recordedShotDrafts[0];
  const showScreenMetrics = type === "screen" && Boolean(screenMetricShot);

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Record Detail</p>
          <h1>{formatSessionDate(detail.session.date, language)} {text(language, "기록", "Record")}</h1>
          <p>{text(language, "운동 정보와 클럽별 기록을 수정하거나 세션 전체를 삭제합니다.", "Edit session info and club records, or delete the whole session.")}</p>
        </div>
        <div className="page-actions">
          <NavLink className="button button-secondary" to="/calendar">
            <ArrowLeft size={16} />
            {text(language, "캘린더", "Calendar")}
          </NavLink>
          <Button className="button-danger" onClick={removeSession} type="button" variant="secondary">
            <Trash2 size={16} />
            {text(language, "삭제", "Delete")}
          </Button>
        </div>
      </header>

      <div className="record-summary-grid">
        <Card>
          <p className="card-kicker">Type</p>
          <div className="big-number">{sessionTypeLabel(detail.session.type, language)}</div>
        </Card>
        <Card>
          <p className="card-kicker">Duration</p>
          <div className="big-number">
            {detail.session.durationMinutes ?? "-"}
            {detail.session.durationMinutes ? <span>min</span> : null}
          </div>
        </Card>
        <Card>
          <p className="card-kicker">Best Carry</p>
          <div className="big-number">
            {formatDistance(bestCarry, distanceUnit).replace(distanceUnit, "")}
            {bestCarry ? <span>{distanceUnit}</span> : null}
          </div>
        </Card>
        <Card>
          <p className="card-kicker">Clubs</p>
          <div className="big-number">
            {shotCount}
            <span>items</span>
          </div>
        </Card>
      </div>

      <form className={hasClubRecords ? "log-layout" : "log-layout log-layout-session-only"} onSubmit={submit}>
        <div className="form-stack">
          <Card>
            <div className="card-title-row">
              <div>
                <p className="card-kicker">Session</p>
                <h2>{text(language, "운동 정보", "Session Info")}</h2>
              </div>
              <Chip tone="accent">{sessionTypeLabel(type, language)}</Chip>
            </div>
            <div className="form-grid">
              <label className="field">
                {text(language, "날짜", "Date")}
                <input onChange={(event) => setDate(event.target.value)} type="date" value={date} />
              </label>
              <label className="field">
                {text(language, "유형", "Type")}
                <select
                  onChange={(event) => {
                    const nextType = event.target.value as SessionType;
                    setType(nextType);
                    if (nextType === "screen" && !location.trim()) setLocation(SCREEN_GOLF_LOCATION);
                  }}
                  value={type}
                >
                  {sessionTypes.map((option) => (
                    <option key={option} value={option}>
                      {sessionTypeLabel(option, language)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                {text(language, "시작 시간", "Start Time")}
                <input onChange={(event) => setStartTime(event.target.value)} type="time" value={startTime} />
              </label>
              <label className="field">
                {text(language, "총 시간 (분)", "Duration (min)")}
                <input inputMode="numeric" onChange={(event) => setDurationMinutes(cleanNumberInput(event.target.value))} value={durationMinutes} />
              </label>
              <label className="field">
                {text(language, "장소", "Location")}
                <input onChange={(event) => setLocation(event.target.value)} value={location} />
              </label>
              <label className="field">
                {text(language, "타구 수", "Balls Hit")}
                <input inputMode="numeric" onChange={(event) => setBallsHit(cleanNumberInput(event.target.value))} value={ballsHit} />
              </label>
            </div>
          </Card>

          <Card>
            <div className="card-title-row">
              <div>
                <p className="card-kicker">Condition</p>
                <h2>{text(language, "컨디션 · 1~5점", "Condition · 1-5")}</h2>
              </div>
            </div>
            <div className="score-grid">
              <ScorePicker label={text(language, "컨디션", "Condition")} onChange={setCondition} value={condition} />
              <ScorePicker label={text(language, "집중도", "Focus")} onChange={setFocus} value={focus} />
              <ScorePicker label={text(language, "체감", "Feel")} onChange={setFeel} value={feel} />
            </div>
          </Card>

          <Card>
            <div className="card-title-row">
              <div>
                <p className="card-kicker">Notes</p>
                <h2>{text(language, "메모", "Notes")}</h2>
              </div>
            </div>
            <label className="field">
              {text(language, "오늘의 느낌, 개선할 점", "Today's feel and improvement points")}
              <textarea onChange={(event) => setNotes(event.target.value)} rows={5} value={notes} />
            </label>
          </Card>
        </div>

        <div className="form-stack">
          {hasClubRecords ? (
            <Card>
              <div className="card-title-row">
                <div>
                  <p className="card-kicker">Club Records</p>
                  <h2>{text(language, "클럽별 기록", "Club Records")}</h2>
                </div>
                <Chip>{distanceUnit}</Chip>
              </div>
              <div className="club-entry-list">
                {shotDrafts.map((shot) => (
                  <div className="club-entry" key={shot.club}>
                    <strong>{clubLabel(shot.club, language)}</strong>
                    <label>
                      {text(language, "캐리", "Carry")} {distanceUnit}
                      <input
                        inputMode="decimal"
                        onChange={(event) => updateShot(shot.club, "carryM", cleanNumberInput(event.target.value, { decimal: true }))}
                        placeholder="-"
                        value={shot.carryM}
                      />
                    </label>
                    <label>
                      {text(language, "토탈", "Total")} {distanceUnit}
                      <input
                        inputMode="decimal"
                        onChange={(event) => updateShot(shot.club, "totalM", cleanNumberInput(event.target.value, { decimal: true }))}
                        placeholder="-"
                        value={shot.totalM}
                      />
                    </label>
                    <label>
                      {text(language, "볼스피드", "Ball Speed")}
                      <input
                        inputMode="decimal"
                        onChange={(event) => updateShot(shot.club, "ballSpeed", cleanNumberInput(event.target.value, { decimal: true }))}
                        placeholder="-"
                        value={shot.ballSpeed}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {showScreenMetrics && screenMetricShot ? (
            <Card>
              <div className="card-title-row">
                <div>
                  <p className="card-kicker">Screen Metrics</p>
                  <h2>{clubLabel(screenMetricShot.club, language)} {text(language, "스크린 메트릭", "Screen Metrics")}</h2>
                </div>
                <Chip>edit</Chip>
              </div>
              <div className="detail-club-tabs" aria-label="Screen metric club">
                {recordedShotDrafts.map((shot) => (
                  <button
                    className={shot.club === screenMetricShot.club ? "chip chip-accent active" : "chip"}
                    key={shot.club}
                    onClick={() => setScreenMetricClub(shot.club)}
                    type="button"
                  >
                    {clubLabel(shot.club, language)}
                  </button>
                ))}
              </div>
              <div className="metric-grid">
                <label className="field">
                  Head speed
                  <input
                    inputMode="decimal"
                    onChange={(event) => updateShot(screenMetricShot.club, "headSpeed", cleanNumberInput(event.target.value, { decimal: true }))}
                    placeholder="-"
                    value={screenMetricShot.headSpeed}
                  />
                </label>
                <label className="field">
                  Launch angle
                  <input
                    inputMode="decimal"
                    onChange={(event) => updateShot(screenMetricShot.club, "launchAngle", cleanNumberInput(event.target.value, { decimal: true }))}
                    placeholder="-"
                    value={screenMetricShot.launchAngle}
                  />
                </label>
                <label className="field">
                  Backspin
                  <input
                    inputMode="numeric"
                    onChange={(event) => updateShot(screenMetricShot.club, "backspin", cleanNumberInput(event.target.value))}
                    placeholder="-"
                    value={screenMetricShot.backspin}
                  />
                </label>
                <label className="field">
                  Sidespin
                  <input
                    inputMode="decimal"
                    onChange={(event) => updateShot(screenMetricShot.club, "sidespin", cleanNumberInput(event.target.value, { decimal: true, signed: true }))}
                    placeholder="-"
                    value={screenMetricShot.sidespin}
                  />
                </label>
                <label className="field">
                  Side dev {distanceUnit}
                  <input
                    inputMode="decimal"
                    onChange={(event) => updateShot(screenMetricShot.club, "sideDeviationM", cleanNumberInput(event.target.value, { decimal: true, signed: true }))}
                    placeholder="-"
                    value={screenMetricShot.sideDeviationM}
                  />
                </label>
              </div>
            </Card>
          ) : null}

          {error ? <div className="form-error">{error}</div> : null}
          {saved ? <div className="form-success">{saved}</div> : null}

          <div className="save-row">
            <Button onClick={() => navigate(-1)} type="button" variant="secondary">
              {text(language, "취소", "Cancel")}
            </Button>
            <Button type="submit">
              <Save size={16} />
              {text(language, "변경 저장", "Save Changes")}
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}
