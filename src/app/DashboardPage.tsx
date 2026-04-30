import { NavLink } from "react-router-dom";
import { MonitorPlay, Scale } from "lucide-react";
import { Card } from "../components/ui/Card";
import { StatCard } from "../components/ui/StatCard";
import { Chip } from "../components/ui/Chip";
import { Heatmap } from "../components/charts/Heatmap";
import { LineChart } from "../components/charts/LineChart";
import { CLUBS, clubLabel } from "../data/defaultData";
import { addDays, formatLongDate, todayDateKey, toDateKey } from "../data/dates";
import { sessionTypeLabel, text, useLanguage } from "../data/i18n";
import { bestCarry, bmi, carryTrend, latestWeight, monthlyDurationHours, monthlySessions, practiceHeatmap, recentRecordRows, weightTrend } from "../data/selectors";
import type { Club } from "../data/schema";
import { useGolfLog } from "../data/store";
import { formatDistance, kgToDisplay, metersToDisplay } from "../data/units";

const featuredClubs: Club[] = ["Driver", "7I", "PW"];

function statNumber(value: number | undefined, digits = 0) {
  if (typeof value !== "number") return "-";
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

function currentStreakDays(sessionDates: string[], todayKey: string) {
  const dateSet = new Set(sessionDates);
  let count = 0;
  let cursor = new Date(`${todayKey}T00:00:00`);

  while (dateSet.has(toDateKey(cursor))) {
    count += 1;
    cursor = addDays(cursor, -1);
  }

  return count;
}

export function DashboardPage() {
  const { data } = useGolfLog();
  const { language } = useLanguage();
  const todayKey = todayDateKey();
  const streakDays = currentStreakDays(
    data.sessions.map((session) => session.date),
    todayKey,
  );
  const distanceUnit = data.profile.distanceUnit;
  const weightUnit = data.profile.weightUnit;
  const driverBest = bestCarry(data, "Driver") ?? 0;
  const driverBestDisplay = metersToDisplay(driverBest || undefined, distanceUnit);
  const driverValues = carryTrend(data, "Driver")
    .slice(-12)
    .map((value) => metersToDisplay(value, distanceUnit) ?? 0);
  const weightValues = weightTrend(data)
    .slice(-30)
    .map((value) => kgToDisplay(value, weightUnit) ?? 0);
  const currentWeight = latestWeight(data);
  const currentWeightDisplay = kgToDisplay(currentWeight, weightUnit);
  const currentBmi = bmi(data);
  const sessions = monthlySessions(data);
  const durationHours = monthlyDurationHours(data);
  const recordRows = recentRecordRows(data, language);
  const heatValues = practiceHeatmap(data, 12);
  const dashboardStats = [
    {
      label: text(language, "드라이버 최고", "Driver Best"),
      value: statNumber(driverBestDisplay),
      unit: driverBest ? distanceUnit : "",
      delta: text(language, "저장 데이터", "Saved data"),
      note: driverBest >= 231 ? text(language, "늘고있어!", "Improving") : undefined,
    },
    { label: text(language, "이번 달 기록", "This Month"), value: String(sessions.length), unit: text(language, "회", ""), delta: `${durationHours.toFixed(1)}h` },
    { label: text(language, "체중", "Weight"), value: statNumber(currentWeightDisplay, 1), unit: currentWeight ? weightUnit : "", delta: text(language, "최근 입력", "Latest") },
    { label: "BMI", value: currentBmi ? currentBmi.toFixed(1) : "-", delta: currentBmi ? text(language, "정상범위", "Normal") : text(language, "입력필요", "Needed") },
  ];

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>{formatLongDate(todayKey, language)}</h1>
          <p>
            {streakDays
              ? text(language, `${data.profile.name}님, ${streakDays}일째 연속 기록 중`, `${data.profile.name}, ${streakDays}-day streak`)
              : text(language, `${data.profile.name}님, 스크린골프 기록을 입력하세요`, `${data.profile.name}, add a screen golf record`)}
          </p>
        </div>
        <div className="page-actions">
          <NavLink className="button button-secondary" to="/health">
            <Scale size={16} />
            {text(language, "체중", "Weight")}
          </NavLink>
          <NavLink className="button button-primary" to="/screen-golf">
            <MonitorPlay size={16} />
            {text(language, "스크린 기록", "Screen Record")}
          </NavLink>
        </div>
      </header>

      <div className="dashboard-grid">
        {dashboardStats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}

        <Card className="chart-card span-2">
          <div className="card-title-row">
            <div>
              <p className="card-kicker">Driver Trend</p>
              <h2>{text(language, "드라이버 일별 최고기록", "Driver Daily Best")}</h2>
            </div>
            <Chip tone="accent">best {formatDistance(driverBest || undefined, distanceUnit)}</Chip>
          </div>
          <LineChart values={driverValues} height={190} markerLabel="best" />
          <p className="hand-note">{text(language, "오늘 기준 최근 기록", "Recent records through today")}</p>
        </Card>

        <Card className="chart-card span-2">
          <div className="card-title-row">
            <div>
              <p className="card-kicker">Health</p>
              <h2>{text(language, "체중 · 최근 30일", "Weight · Last 30 Days")}</h2>
            </div>
            <Chip>{currentWeight ? `${statNumber(currentWeightDisplay, 1)}${weightUnit}` : "no data"}</Chip>
          </div>
          <LineChart values={weightValues} height={190} />
        </Card>

        <Card className="span-3">
          <div className="card-title-row">
            <div>
              <p className="card-kicker">Recent Records</p>
              <h2>{text(language, "최근 기록", "Recent Records")}</h2>
            </div>
            <Chip tone="fairway">{sessions.length} sessions</Chip>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{text(language, "날짜", "Date")}</th>
                  <th>{text(language, "유형", "Type")}</th>
                  {featuredClubs.map((club) => (
                    <th key={club}>{clubLabel(club, language)}</th>
                  ))}
                  <th>{text(language, "운동시간", "Duration")}</th>
                  <th>{text(language, "장소", "Location")}</th>
                </tr>
              </thead>
              <tbody>
                {recordRows.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <NavLink className="record-link" to={`/sessions/${record.id}`}>
                        {record.date}
                      </NavLink>
                    </td>
                    <td>{sessionTypeLabel(record.type, language)}</td>
                    {featuredClubs.map((club) => (
                      <td key={`${record.id}-${club}`}>{formatDistance(record.clubs[CLUBS.indexOf(club)], distanceUnit)}</td>
                    ))}
                    <td>{record.duration}</td>
                    <td>{record.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <div className="card-title-row">
            <div>
              <p className="card-kicker">Practice Grass</p>
              <h2>{text(language, "최근 12주", "Last 12 Weeks")}</h2>
            </div>
          </div>
          <Heatmap values={heatValues} weeks={12} />
          <div className="heat-legend">
            <span>less</span>
            <i />
            <i className="lvl-1" />
            <i className="lvl-2" />
            <i className="lvl-3" />
            <span>more</span>
          </div>
        </Card>
      </div>
    </section>
  );
}
