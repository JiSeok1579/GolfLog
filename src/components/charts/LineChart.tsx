type LineChartProps = {
  values: number[];
  height?: number;
  markerLabel?: string;
};

export function LineChart({ values, height = 160, markerLabel }: LineChartProps) {
  const width = 640;
  const padding = { top: 36, right: 18, bottom: 26, left: 42 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const plottedValues = values.length ? values : [0];
  const max = Math.max(...plottedValues);
  const min = Math.min(...plottedValues);
  const range = Math.max(max - min, 1);
  const x = (index: number) => padding.left + (index / Math.max(plottedValues.length - 1, 1)) * chartWidth;
  const y = (value: number) => padding.top + chartHeight - ((value - min) / range) * chartHeight;
  const path = plottedValues.map((value, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(value)}`).join(" ");
  const bestIndex = plottedValues.indexOf(max);

  return (
    <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Line chart">
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + chartHeight} className="chart-axis" />
      <line
        x1={padding.left}
        y1={padding.top + chartHeight}
        x2={padding.left + chartWidth}
        y2={padding.top + chartHeight}
        className="chart-axis"
      />
      {[0, 0.5, 1].map((tick) => (
        <line
          className="chart-grid"
          key={tick}
          x1={padding.left}
          y1={padding.top + chartHeight * tick}
          x2={padding.left + chartWidth}
          y2={padding.top + chartHeight * tick}
        />
      ))}
      {values.length ? <path className="chart-line" d={path} /> : null}
      {plottedValues.map((value, index) => (
        <circle className="chart-dot" cx={x(index)} cy={y(value)} key={`${value}-${index}`} r={index === bestIndex ? 4 : 2.5} />
      ))}
      {markerLabel && values.length ? (
        <g>
          <circle className="chart-best-ring" cx={x(bestIndex)} cy={y(max)} r="8" />
          <text className="chart-label" x={x(bestIndex)} y={y(max) - 14} textAnchor="middle">
            {markerLabel}
          </text>
        </g>
      ) : null}
      <text className="chart-tick" x={padding.left - 8} y={padding.top + 4} textAnchor="end">
        {Math.round(max)}
      </text>
      <text className="chart-tick" x={padding.left - 8} y={padding.top + chartHeight + 4} textAnchor="end">
        {Math.round(min)}
      </text>
      {!values.length ? (
        <text className="chart-empty" textAnchor="middle" x={width / 2} y={height / 2}>
          no data
        </text>
      ) : null}
    </svg>
  );
}
