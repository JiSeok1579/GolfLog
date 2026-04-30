import { useMemo, useState, type FormEvent } from "react";
import { NavLink } from "react-router-dom";
import { Save } from "lucide-react";
import { ClubSelector } from "../components/ClubSelector";
import { RadarChart } from "../components/charts/RadarChart";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Chip } from "../components/ui/Chip";
import { SCREEN_GOLF_LOCATION } from "../data/constants";
import { clubLabel } from "../data/defaultData";
import { text, useLanguage } from "../data/i18n";
import { cleanNumberInput } from "../data/numberInput";
import { averageScreenShot, latestScreenShot, screenShotRows, shotDnaValues } from "../data/selectors";
import { newClubShotSchema, newSessionSchema, type Club } from "../data/schema";
import { useGolfLog } from "../data/store";
import { displayDistanceInput, displayToMeters, formatDistance } from "../data/units";

type ScreenDraft = {
  carryM: string;
  totalM: string;
  ballSpeed: string;
  headSpeed: string;
  launchAngle: string;
  backspin: string;
  sidespin: string;
  sideDeviationM: string;
};

const radarAxes = ["Ball", "Head", "Launch", "Spin", "Smash", "Accuracy", "Carry", "Total"];
const emptyScreenDraft: ScreenDraft = {
  carryM: "",
  totalM: "",
  ballSpeed: "",
  headSpeed: "",
  launchAngle: "",
  backspin: "",
  sidespin: "",
  sideDeviationM: "",
};

function todayString() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function optionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatMaybe(value: number | undefined, suffix = "") {
  if (typeof value !== "number") return "-";
  return `${Number.isInteger(value) ? value : value.toFixed(1)}${suffix}`;
}

export function ScreenGolfPage() {
  const { addSessionWithShots, data } = useGolfLog();
  const { language } = useLanguage();
  const distanceUnit = data.profile.distanceUnit;
  const [selectedClub, setSelectedClub] = useState<Club>("Driver");
  const [date, setDate] = useState(todayString);
  const [startTime, setStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [location, setLocation] = useState(SCREEN_GOLF_LOCATION);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [savedSessionId, setSavedSessionId] = useState("");
  const [draft, setDraft] = useState<ScreenDraft>(emptyScreenDraft);
  const exampleDraft = useMemo<ScreenDraft>(() => ({
    carryM: displayDistanceInput(226, distanceUnit),
    totalM: displayDistanceInput(245, distanceUnit),
    ballSpeed: "68.2",
    headSpeed: "46.8",
    launchAngle: "14.2",
    backspin: "2840",
    sidespin: "-180",
    sideDeviationM: displayDistanceInput(3.2, distanceUnit, 1),
  }), [distanceUnit]);

  const latest = latestScreenShot(data, selectedClub);
  const average = averageScreenShot(data, selectedClub);
  const recentRows = screenShotRows(data, selectedClub, 8, language);
  const previewShot = useMemo(
    () => ({
      club: selectedClub,
      carryM: displayToMeters(optionalNumber(draft.carryM), distanceUnit),
      totalM: displayToMeters(optionalNumber(draft.totalM), distanceUnit),
      ballSpeed: optionalNumber(draft.ballSpeed),
      headSpeed: optionalNumber(draft.headSpeed),
      launchAngle: optionalNumber(draft.launchAngle),
      backspin: optionalNumber(draft.backspin),
      sidespin: optionalNumber(draft.sidespin),
      sideDeviationM: displayToMeters(optionalNumber(draft.sideDeviationM), distanceUnit),
    }),
    [distanceUnit, draft, selectedClub],
  );
  const previewValues = shotDnaValues(previewShot);
  const compareValues = shotDnaValues(average);

  const updateDraft = (key: keyof ScreenDraft, value: string) => {
    setSaved("");
    setSavedSessionId("");
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const updateNumberDraft = (key: keyof ScreenDraft, value: string, options: Parameters<typeof cleanNumberInput>[1] = { decimal: true }) => {
    updateDraft(key, cleanNumberInput(value, options));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSaved("");
    setSavedSessionId("");

    const session = {
      date,
      type: "screen" as const,
      startTime: startTime || undefined,
      durationMinutes: optionalNumber(durationMinutes),
      location: location.trim() || SCREEN_GOLF_LOCATION,
      notes: `${clubLabel(selectedClub, language)} screen metrics`,
    };
    const sessionResult = newSessionSchema.safeParse(session);
    if (!sessionResult.success) {
      setError(text(language, "세션 정보를 다시 확인해주세요.", "Check the session information."));
      return;
    }

    const shot = {
      club: selectedClub,
      carryM: displayToMeters(optionalNumber(draft.carryM), distanceUnit),
      totalM: displayToMeters(optionalNumber(draft.totalM), distanceUnit),
      ballSpeed: optionalNumber(draft.ballSpeed),
      headSpeed: optionalNumber(draft.headSpeed),
      launchAngle: optionalNumber(draft.launchAngle),
      backspin: optionalNumber(draft.backspin),
      sidespin: optionalNumber(draft.sidespin),
      sideDeviationM: displayToMeters(optionalNumber(draft.sideDeviationM), distanceUnit),
    };
    const shotResult = newClubShotSchema.safeParse(shot);
    if (!shotResult.success) {
      setError(text(language, "샷 메트릭 값을 다시 확인해주세요.", "Check the shot metric values."));
      return;
    }

    if (typeof shot.carryM !== "number") {
      setError(text(language, "비거리 탭 반영을 위해 캐리 값을 입력해주세요.", "Enter carry distance so it appears in the Distance tab."));
      return;
    }

    const sessionId = addSessionWithShots(sessionResult.data, [shotResult.data]);
    setSavedSessionId(sessionId);
    setSaved(text(language, `${clubLabel(selectedClub, language)} 스크린골프 결과를 저장했습니다. 비거리 탭에도 반영되었습니다.`, `${clubLabel(selectedClub, language)} screen golf result saved and reflected in Distance.`));
  };

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Screen Golf</p>
          <h1>{text(language, "스크린골프", "Screen Golf")}</h1>
          <p>{text(language, "스윙 데이터를 입력하면 Shot DNA 레이더로 현재 샷 프로필을 확인합니다.", "Enter swing data and review the current shot profile on the Shot DNA radar.")}</p>
        </div>
        <Chip tone="accent">{clubLabel(selectedClub, language)}</Chip>
      </header>

      <ClubSelector selectedClub={selectedClub} onChange={setSelectedClub} />

      <form className="screen-grid" onSubmit={submit}>
        <div className="form-stack">
          <Card>
            <div className="card-title-row">
              <div>
                <p className="card-kicker">Session</p>
                <h2>{text(language, "세션 정보", "Session Info")}</h2>
              </div>
            </div>
            <div className="form-grid">
              <label className="field">
                {text(language, "날짜", "Date")}
                <input onChange={(event) => setDate(event.target.value)} type="date" value={date} />
              </label>
              <label className="field">
                {text(language, "시작 시간", "Start Time")}
                <input data-example={startTime ? undefined : "true"} onChange={(event) => setStartTime(event.target.value)} placeholder="14:30" type="time" value={startTime} />
              </label>
              <label className="field">
                {text(language, "총 시간 (분)", "Duration (min)")}
                <input data-example={durationMinutes ? undefined : "true"} inputMode="numeric" onChange={(event) => setDurationMinutes(cleanNumberInput(event.target.value))} placeholder="60" value={durationMinutes} />
              </label>
              <label className="field">
                {text(language, "장소", "Location")}
                <input onChange={(event) => setLocation(event.target.value)} value={location} />
              </label>
            </div>
          </Card>

          <Card>
            <div className="card-title-row">
              <div>
                <p className="card-kicker">Shot Metrics</p>
                <h2>{clubLabel(selectedClub, language)} {text(language, "샷 데이터", "Shot Data")}</h2>
              </div>
              <Chip>live preview</Chip>
            </div>
            <div className="metric-grid">
              <label className="field">
                Carry {distanceUnit}
                <input data-example={draft.carryM ? undefined : "true"} inputMode="decimal" onChange={(event) => updateNumberDraft("carryM", event.target.value)} placeholder={exampleDraft.carryM} value={draft.carryM} />
              </label>
              <label className="field">
                Total {distanceUnit}
                <input data-example={draft.totalM ? undefined : "true"} inputMode="decimal" onChange={(event) => updateNumberDraft("totalM", event.target.value)} placeholder={exampleDraft.totalM} value={draft.totalM} />
              </label>
              <label className="field">
                Ball speed
                <input data-example={draft.ballSpeed ? undefined : "true"} inputMode="decimal" onChange={(event) => updateNumberDraft("ballSpeed", event.target.value)} placeholder={exampleDraft.ballSpeed} value={draft.ballSpeed} />
              </label>
              <label className="field">
                Head speed
                <input data-example={draft.headSpeed ? undefined : "true"} inputMode="decimal" onChange={(event) => updateNumberDraft("headSpeed", event.target.value)} placeholder={exampleDraft.headSpeed} value={draft.headSpeed} />
              </label>
              <label className="field">
                Launch angle
                <input data-example={draft.launchAngle ? undefined : "true"} inputMode="decimal" onChange={(event) => updateNumberDraft("launchAngle", event.target.value)} placeholder={exampleDraft.launchAngle} value={draft.launchAngle} />
              </label>
              <label className="field">
                Backspin
                <input data-example={draft.backspin ? undefined : "true"} inputMode="numeric" onChange={(event) => updateNumberDraft("backspin", event.target.value, {})} placeholder={exampleDraft.backspin} value={draft.backspin} />
              </label>
              <label className="field">
                Sidespin
                <input data-example={draft.sidespin ? undefined : "true"} inputMode="decimal" onChange={(event) => updateNumberDraft("sidespin", event.target.value, { decimal: true, signed: true })} placeholder={exampleDraft.sidespin} value={draft.sidespin} />
              </label>
              <label className="field">
                Side dev {distanceUnit}
                <input data-example={draft.sideDeviationM ? undefined : "true"} inputMode="decimal" onChange={(event) => updateNumberDraft("sideDeviationM", event.target.value, { decimal: true, signed: true })} placeholder={exampleDraft.sideDeviationM} value={draft.sideDeviationM} />
              </label>
            </div>
          </Card>

          {error ? <div className="form-error">{error}</div> : null}
          {saved ? (
            <div className="form-success screen-save-feedback">
              <span>{saved}</span>
              <div className="save-feedback-actions">
                {savedSessionId ? (
                  <NavLink className="button button-secondary" to={`/sessions/${savedSessionId}`}>
                    {text(language, "상세 보기", "View Detail")}
                  </NavLink>
                ) : null}
                <NavLink className="button button-primary" to="/distance">
                  {text(language, "비거리 확인", "Check Distance")}
                </NavLink>
              </div>
            </div>
          ) : null}

          <div className="save-row">
            <Button type="submit">
              <Save size={16} />
              {text(language, "결과 저장", "Save Result")}
            </Button>
          </div>
        </div>

        <div className="form-stack">
          <Card className="radar-card">
            <div className="card-title-row">
              <div>
                <p className="card-kicker">Shot DNA</p>
                <h2>{text(language, "현재 입력 vs 평균", "Current Input vs Average")}</h2>
              </div>
              <Chip tone="accent">8 axes</Chip>
            </div>
            <RadarChart axes={radarAxes} compareValues={compareValues} values={previewValues} />
            <div className="radar-legend">
              <span className="current">{text(language, "현재 입력", "Current Input")}</span>
              <span className="compare">{text(language, "평균", "Average")}</span>
            </div>
          </Card>

          <Card>
            <div className="card-title-row">
              <div>
                <p className="card-kicker">Latest</p>
                <h2>{clubLabel(selectedClub, language)} {text(language, "최신 스크린 기록", "Latest Screen Record")}</h2>
              </div>
            </div>
            <div className="screen-stat-grid">
              <div>
                <span>Carry</span>
                <strong>{formatDistance(latest?.shot.carryM, distanceUnit)}</strong>
              </div>
              <div>
                <span>Ball</span>
                <strong>{formatMaybe(latest?.shot.ballSpeed, "m/s")}</strong>
              </div>
              <div>
                <span>Launch</span>
                <strong>{formatMaybe(latest?.shot.launchAngle, "°")}</strong>
              </div>
              <div>
                <span>Spin</span>
                <strong>{formatMaybe(latest?.shot.backspin, "rpm")}</strong>
              </div>
            </div>
          </Card>
        </div>
      </form>

      <Card className="screen-table-card">
        <div className="card-title-row">
          <div>
            <p className="card-kicker">History</p>
            <h2>{clubLabel(selectedClub, language)} {text(language, "스크린골프 기록", "Screen Golf History")}</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{text(language, "날짜", "Date")}</th>
                <th>{text(language, "캐리", "Carry")}</th>
                <th>{text(language, "토탈", "Total")}</th>
                <th>{text(language, "볼스피드", "Ball Speed")}</th>
                <th>{text(language, "헤드스피드", "Head Speed")}</th>
                <th>{text(language, "런치", "Launch")}</th>
                <th>{text(language, "백스핀", "Backspin")}</th>
                <th>{text(language, "좌우편차", "Side Dev")}</th>
                <th>{text(language, "장소", "Location")}</th>
              </tr>
            </thead>
            <tbody>
              {recentRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <NavLink className="record-link" to={`/sessions/${row.sessionId}`}>
                      {row.date}
                    </NavLink>
                  </td>
                  <td>{formatDistance(row.shot.carryM, distanceUnit)}</td>
                  <td>{formatDistance(row.shot.totalM, distanceUnit)}</td>
                  <td>{formatMaybe(row.shot.ballSpeed, "m/s")}</td>
                  <td>{formatMaybe(row.shot.headSpeed, "m/s")}</td>
                  <td>{formatMaybe(row.shot.launchAngle, "°")}</td>
                  <td>{formatMaybe(row.shot.backspin, "rpm")}</td>
                  <td>{formatDistance(row.shot.sideDeviationM, distanceUnit, 1)}</td>
                  <td>{row.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
