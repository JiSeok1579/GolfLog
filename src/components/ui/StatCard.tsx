import { Card } from "./Card";
import { Chip } from "./Chip";

type StatCardProps = {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  note?: string;
};

export function StatCard({ label, value, unit, delta, note }: StatCardProps) {
  return (
    <Card>
      <p className="card-kicker">{label}</p>
      <div className="big-number">
        {value}
        {unit ? <span>{unit}</span> : null}
      </div>
      {delta ? (
        <div className="stat-meta">
          <Chip tone="accent">{delta}</Chip>
          {note ? <em>{note}</em> : null}
        </div>
      ) : null}
    </Card>
  );
}
