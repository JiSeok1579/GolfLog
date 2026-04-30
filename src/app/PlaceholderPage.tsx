import { Card } from "../components/ui/Card";
import { Chip } from "../components/ui/Chip";

type PlaceholderPageProps = {
  title: string;
  phase: string;
};

export function PlaceholderPage({ title, phase }: PlaceholderPageProps) {
  return (
    <section className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">{phase}</p>
          <h1>{title}</h1>
          <p>와이어프레임 기준으로 다음 단계에서 실제 입력과 시각화를 연결합니다.</p>
        </div>
        <Chip>planned</Chip>
      </header>
      <Card className="placeholder-card">
        <p>{title} 화면은 라우팅과 디자인 셸까지 먼저 연결했습니다.</p>
      </Card>
    </section>
  );
}
