import type { CSSProperties } from "react";

type HeatmapProps = {
  values: number[];
  weeks?: number;
};

export function Heatmap({ values, weeks = 12 }: HeatmapProps) {
  return (
    <div className="heatmap" style={{ "--weeks": weeks } as CSSProperties}>
      {Array.from({ length: weeks * 7 }).map((_, index) => {
        const value = values[index] ?? 0;
        const strength = Math.min(value / 4, 1);
        return <span key={index} style={{ "--strength": strength } as CSSProperties} />;
      })}
    </div>
  );
}
