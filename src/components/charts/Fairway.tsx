import { displayToMeters, formatDisplayDistance, formatDistanceLong, metersToDisplay, type DistanceUnit } from "../../data/units";
import type { Language } from "../../data/i18n";

type FairwayShot = {
  label: string;
  distanceM?: number;
  lateralM?: number;
  tone?: "average" | "best" | "latest";
};

type FairwayProps = {
  shots: FairwayShot[];
  maxDistanceM?: number;
  unit?: DistanceUnit;
  language?: Language;
};

export function Fairway({ shots, maxDistanceM = 280, unit = "m", language = "ko" }: FairwayProps) {
  const width = 720;
  const height = 250;
  const padLeft = 42;
  const padRight = 28;
  const padTop = 24;
  const padBottom = 36;
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;
  const teeX = padLeft;
  const midY = padTop + chartHeight / 2;
  const xAt = (distanceM = 0) => padLeft + Math.min(distanceM / maxDistanceM, 1) * chartWidth;
  const yAt = (lateralM = 0) => midY + lateralM * 2;
  const rawMaxDisplayDistance = metersToDisplay(maxDistanceM, unit) ?? maxDistanceM;
  const maxDisplayDistance = Math.max(100, Math.ceil(rawMaxDisplayDistance / 100) * 100);
  const gridDistances = Array.from({ length: Math.floor(maxDisplayDistance / 100) }, (_, index) => (index + 1) * 100);

  return (
    <svg className="fairway-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Fairway distance visualization">
      <rect className="fairway-rough" height={height} width={width} x="0" y="0" />
      <path
        className="fairway-shape"
        d={`M ${padLeft - 14} ${padTop + chartHeight * 0.18}
          Q ${padLeft + chartWidth * 0.28} ${padTop - 10}, ${padLeft + chartWidth * 0.58} ${padTop + 10}
          T ${padLeft + chartWidth + 8} ${padTop + chartHeight * 0.24}
          L ${padLeft + chartWidth + 8} ${padTop + chartHeight * 0.78}
          Q ${padLeft + chartWidth * 0.62} ${padTop + chartHeight + 12}, ${padLeft + chartWidth * 0.28} ${padTop + chartHeight * 0.9}
          T ${padLeft - 14} ${padTop + chartHeight * 0.82}
          Z`}
      />
      <line className="fairway-center" x1={padLeft} x2={padLeft + chartWidth} y1={midY} y2={midY} />
      {gridDistances.map((distance) => {
        const x = xAt(displayToMeters(distance, unit));
        return (
          <g key={distance}>
            <line className="fairway-gridline" x1={x} x2={x} y1={padTop + 8} y2={padTop + chartHeight - 8} />
            <text className="fairway-label" textAnchor="middle" x={x} y={height - 13}>
              {formatDisplayDistance(distance, unit, 0, language)}
            </text>
          </g>
        );
      })}
      <circle className="fairway-tee" cx={teeX} cy={midY} r="6" />
      {shots
        .filter((shot) => shot.distanceM)
        .map((shot, index) => {
          const x = xAt(shot.distanceM);
          const y = yAt(shot.lateralM ?? (index - 1) * 6);
          const isBest = shot.tone === "best";
          const isLatest = shot.tone === "latest";

          return (
            <g className={isBest ? "best" : isLatest ? "latest" : "average"} key={`${shot.label}-${index}`}>
              <path className="fairway-trail" d={`M ${teeX} ${midY} Q ${(teeX + x) / 2} ${midY - 44 - index * 8}, ${x} ${y}`} />
              <circle className="fairway-ball" cx={x} cy={y} r={isBest ? 6 : 4.5} />
              <text className="fairway-shot-label" textAnchor="middle" x={x} y={y - 12}>
                {formatDistanceLong(shot.distanceM, unit, 0, language)}
              </text>
              <text className="fairway-shot-sub" textAnchor="middle" x={x} y={y + 20}>
                {shot.label}
              </text>
            </g>
          );
        })}
    </svg>
  );
}
