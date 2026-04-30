type RadarChartProps = {
  axes: string[];
  values: number[];
  compareValues?: number[];
  size?: number;
};

function points(values: number[], size: number, radius: number, max: number) {
  const center = size / 2;
  return values
    .map((value, index) => {
      const angle = (Math.PI * 2 * index) / values.length - Math.PI / 2;
      const distance = radius * (Math.max(0, Math.min(max, value)) / max);
      return `${center + Math.cos(angle) * distance},${center + Math.sin(angle) * distance}`;
    })
    .join(" ");
}

export function RadarChart({ axes, values, compareValues, size = 310 }: RadarChartProps) {
  const center = size / 2;
  const radius = size / 2 - 58;
  const labelRadius = radius + 34;
  const max = 10;
  const angle = (index: number) => (Math.PI * 2 * index) / axes.length - Math.PI / 2;

  return (
    <svg className="radar-chart" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Shot DNA radar chart">
      {[0.25, 0.5, 0.75, 1].map((scale) => (
        <polygon
          className="radar-ring"
          key={scale}
          points={axes
            .map((_, index) => {
              const a = angle(index);
              return `${center + Math.cos(a) * radius * scale},${center + Math.sin(a) * radius * scale}`;
            })
            .join(" ")}
        />
      ))}
      {axes.map((axis, index) => {
        const a = angle(index);
        const horizontal = Math.cos(a);
        const x = center + Math.cos(a) * radius;
        const y = center + Math.sin(a) * radius;
        const tx = center + Math.cos(a) * labelRadius;
        const ty = center + Math.sin(a) * labelRadius;
        const textAnchor = horizontal > 0.75 ? "end" : horizontal < -0.75 ? "start" : "middle";

        return (
          <g key={axis}>
            <line className="radar-axis" x1={center} x2={x} y1={center} y2={y} />
            <text className="radar-label" dominantBaseline="middle" textAnchor={textAnchor} x={tx} y={ty}>
              {axis}
            </text>
          </g>
        );
      })}
      {compareValues ? <polygon className="radar-area compare" points={points(compareValues, size, radius, max)} /> : null}
      <polygon className="radar-area current" points={points(values, size, radius, max)} />
      {values.map((value, index) => {
        const a = angle(index);
        const distance = radius * (Math.max(0, Math.min(max, value)) / max);
        return <circle className="radar-dot" cx={center + Math.cos(a) * distance} cy={center + Math.sin(a) * distance} key={axes[index]} r="3" />;
      })}
    </svg>
  );
}
