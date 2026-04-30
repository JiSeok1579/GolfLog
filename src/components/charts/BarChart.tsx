type BarChartProps = {
  values: number[];
  labels: string[];
  accentIndex?: number;
  height?: number;
};

export function BarChart({ values, labels, accentIndex = -1, height = 220 }: BarChartProps) {
  const width = 640;
  const padding = { top: 22, right: 16, bottom: 36, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const max = Math.max(...values, 1);
  const step = chartWidth / Math.max(values.length, 1);
  const barWidth = Math.max(12, step * 0.62);

  return (
    <svg className="bar-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Bar chart">
      <line
        className="chart-axis"
        x1={padding.left}
        x2={padding.left + chartWidth}
        y1={padding.top + chartHeight}
        y2={padding.top + chartHeight}
      />
      {[0, 0.5].map((tick) => (
        <line
          className="chart-grid"
          key={tick}
          x1={padding.left}
          x2={padding.left + chartWidth}
          y1={padding.top + chartHeight * tick}
          y2={padding.top + chartHeight * tick}
        />
      ))}
      {values.map((value, index) => {
        const barHeight = (value / max) * chartHeight;
        const x = padding.left + index * step + (step - barWidth) / 2;
        const y = padding.top + chartHeight - barHeight;

        return (
          <g key={`${labels[index]}-${index}`}>
            <rect className={index === accentIndex ? "chart-bar accent" : "chart-bar"} height={barHeight} rx="2" width={barWidth} x={x} y={y} />
            <text className="chart-tick" textAnchor="middle" x={x + barWidth / 2} y={y - 6}>
              {value ? Math.round(value) : "-"}
            </text>
            <text className="chart-tick" textAnchor="middle" x={x + barWidth / 2} y={padding.top + chartHeight + 18}>
              {labels[index]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
