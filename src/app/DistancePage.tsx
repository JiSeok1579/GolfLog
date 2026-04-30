import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { Plus } from "lucide-react";
import { ClubSelector } from "../components/ClubSelector";
import { BarChart } from "../components/charts/BarChart";
import { Fairway } from "../components/charts/Fairway";
import { LineChart } from "../components/charts/LineChart";
import { Card } from "../components/ui/Card";
import { Chip } from "../components/ui/Chip";
import { CLUBS, clubLabel } from "../data/defaultData";
import { sessionTypeLabel, text, useLanguage } from "../data/i18n";
import { averageCarry, bestCarry, carryTrend, clubCarrySummaries, latestClubShot, recentClubShotRows } from "../data/selectors";
import type { Club } from "../data/schema";
import { useGolfLog } from "../data/store";
import { displayToMeters, formatDistanceLong, metersToDisplay } from "../data/units";

export function DistancePage() {
  const { data } = useGolfLog();
  const { language } = useLanguage();
  const distanceUnit = data.profile.distanceUnit;
  const [selectedClub, setSelectedClub] = useState<Club>("Driver");
  const summaries = useMemo(() => clubCarrySummaries(data), [data]);
  const selectedSummary = summaries.find((summary) => summary.club === selectedClub);
  const selectedAverage = averageCarry(data, selectedClub);
  const selectedBest = bestCarry(data, selectedClub);
  const selectedLatest = latestClubShot(data, selectedClub);
  const trend = carryTrend(data, selectedClub)
    .slice(-12)
    .map((value) => metersToDisplay(value, distanceUnit) ?? 0);
  const recentRows = recentClubShotRows(data, selectedClub, 8, language);
  const selectedIndex = CLUBS.indexOf(selectedClub);
  const chartValues = summaries.map((summary) => Math.round(metersToDisplay(summary.average, distanceUnit) ?? 0));
  const referenceDistance = selectedBest ?? selectedAverage ?? 220;
  const referenceDisplayDistance = metersToDisplay(referenceDistance, distanceUnit) ?? 220;
  const maxDisplayDistance = Math.max(300, Math.ceil((referenceDisplayDistance + 30) / 100) * 100);
  const maxDistance = displayToMeters(maxDisplayDistance, distanceUnit) ?? 300;
  const bestGap = selectedBest && selectedAverage ? metersToDisplay(selectedBest - selectedAverage, distanceUnit) : undefined;

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Distance</p>
          <h1>{text(language, "비거리", "Distance")}</h1>
          <p>{text(language, "클럽별 캐리, 평균, 최고 기록을 저장 데이터 기준으로 비교합니다.", "Compare carry, averages, and best records by club from saved data.")}</p>
        </div>
        <NavLink className="button button-primary" to="/screen-golf">
          <Plus size={16} />
          {text(language, "스크린 기록 추가", "Add Screen Record")}
        </NavLink>
      </header>

      <ClubSelector selectedClub={selectedClub} onChange={setSelectedClub} />

      <div className="distance-grid">
        <Card className="span-2">
          <div className="card-title-row">
            <div>
              <p className="card-kicker">Fairway</p>
              <h2>{clubLabel(selectedClub, language)} · {text(language, "최고 vs 평균", "Best vs Average")}</h2>
            </div>
            <Chip tone="fairway">{selectedSummary?.count ?? 0} shots</Chip>
          </div>
          <Fairway
            maxDistanceM={maxDistance}
            language={language}
            unit={distanceUnit}
            shots={[
              { label: text(language, "평균", "Average"), distanceM: selectedAverage ? Math.round(selectedAverage) : undefined, lateralM: -5, tone: "average" },
              { label: text(language, "최고", "Best"), distanceM: selectedBest, lateralM: 2, tone: "best" },
              { label: text(language, "최근", "Latest"), distanceM: selectedLatest?.shot.carryM, lateralM: 8, tone: "latest" },
            ]}
          />
        </Card>

        <Card>
          <p className="card-kicker">Snapshot</p>
          <h2>{clubLabel(selectedClub, language)} {text(language, "요약", "Summary")}</h2>
          <div className="distance-stat-list">
            <div>
              <span>{text(language, "최고", "Best")}</span>
              <strong>{formatDistanceLong(selectedBest, distanceUnit, 0, language)}</strong>
            </div>
            <div>
              <span>{text(language, "평균", "Average")}</span>
              <strong>{formatDistanceLong(selectedAverage, distanceUnit, 0, language)}</strong>
            </div>
            <div>
              <span>{text(language, "최근", "Latest")}</span>
              <strong>{formatDistanceLong(selectedLatest?.shot.carryM, distanceUnit, 0, language)}</strong>
            </div>
            <div>
              <span>{text(language, "기록 수", "Records")}</span>
              <strong>{selectedSummary?.count ?? 0}</strong>
            </div>
          </div>
          <p className="hand-note distance-note">
            {bestGap
              ? `${text(language, "best gap", "best gap")} +${formatDistanceLong(selectedBest && selectedAverage ? selectedBest - selectedAverage : undefined, distanceUnit, 0, language)}`
              : text(language, "기록을 추가하면 분석이 시작됩니다", "Add records to start analysis")}
          </p>
        </Card>

        <Card className="span-2">
          <div className="card-title-row">
            <div>
              <p className="card-kicker">Trend</p>
              <h2>{clubLabel(selectedClub, language)} {text(language, "최근 기록 추이", "Recent Trend")}</h2>
            </div>
            <Chip tone="accent">{trend.length} points</Chip>
          </div>
          <LineChart height={210} markerLabel="best" values={trend} />
        </Card>

        <Card>
          <div className="card-title-row">
            <div>
              <p className="card-kicker">Club Comparison</p>
              <h2>{text(language, "클럽별 평균 캐리", "Average Carry by Club")}</h2>
            </div>
          </div>
          <BarChart accentIndex={selectedIndex} height={210} labels={CLUBS.map((club) => clubLabel(club, language))} values={chartValues} />
        </Card>

        <Card className="span-3">
          <div className="card-title-row">
            <div>
              <p className="card-kicker">Recent Shots</p>
              <h2>{clubLabel(selectedClub, language)} {text(language, "기록 내역", "Shot History")}</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{text(language, "날짜", "Date")}</th>
                  <th>{text(language, "유형", "Type")}</th>
                  <th>{text(language, "캐리", "Carry")}</th>
                  <th>{text(language, "토탈", "Total")}</th>
                  <th>{text(language, "볼스피드", "Ball Speed")}</th>
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
                    <td>{sessionTypeLabel(row.type, language)}</td>
                    <td>{formatDistanceLong(row.carryM, distanceUnit, 0, language)}</td>
                    <td>{formatDistanceLong(row.totalM, distanceUnit, 0, language)}</td>
                    <td>{row.ballSpeed ? `${row.ballSpeed}m/s` : "-"}</td>
                    <td>{row.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </section>
  );
}
