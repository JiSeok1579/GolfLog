import { Camera } from "lucide-react";
import { Card } from "../ui/Card";
import type { SwingAnalysisResult } from "../../data/schema";
import { qualityForAnalysis } from "./AnalysisQualityBadge";

type Language = "ko" | "en";

function label(language: Language, ko: string, en: string) {
  return language === "ko" ? ko : en;
}

export function shouldShowCaptureGuide(analysis: SwingAnalysisResult | null) {
  if (!analysis) return true;
  const quality = qualityForAnalysis(analysis);
  const highDropRate = quality.analyzedFrameCount > 0 && quality.droppedFrames / quality.analyzedFrameCount > 0.2;
  return quality.isFallback || quality.poseConfidence < 0.55 || highDropRate;
}

export function CaptureGuideCard({ analysis, language }: { analysis: SwingAnalysisResult | null; language: Language }) {
  if (!shouldShowCaptureGuide(analysis)) return null;

  const title = analysis
    ? label(language, "촬영 품질을 다시 확인하세요", "Check capture quality")
    : label(language, "분석 전 촬영 기준", "Capture guide");

  return (
    <Card className="capture-guide-card">
      <div className="card-title-row">
        <div>
          <p className="card-kicker">{label(language, "촬영", "Capture")}</p>
          <h2>{title}</h2>
        </div>
        <Camera size={18} />
      </div>
      <ul className="capture-guide-list">
        <li>{label(language, "전신과 클럽 헤드가 프레임 안에 들어오게 촬영합니다.", "Keep the whole body and club head inside the frame.")}</li>
        <li>{label(language, "카메라는 삼각대나 고정된 위치에 둡니다.", "Fix the camera in place.")}</li>
        <li>{label(language, "밝은 조명에서 촬영합니다.", "Use bright lighting.")}</li>
        <li>{label(language, "가능하면 60fps 이상으로 촬영합니다.", "Use 60fps or higher if possible.")}</li>
        <li>{label(language, "후방 또는 정면 중 하나의 각도를 명확히 선택합니다.", "Choose either down-the-line or face-on view.")}</li>
        <li>{label(language, "어두운 배경 앞에서는 어두운 옷을 피합니다.", "Avoid dark clothing against a dark background.")}</li>
      </ul>
    </Card>
  );
}
