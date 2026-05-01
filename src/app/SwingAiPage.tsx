import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Activity, Play, Upload } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Chip } from "../components/ui/Chip";
import { createSwingAnalysis, fetchSwingAnalysis, fetchSwingAnalysisStatus } from "../data/api";
import { CLUBS, clubLabel } from "../data/clubs";
import { text, useLanguage } from "../data/i18n";
import { newSwingAnalysisSchema, type Club, type SwingAnalysisResult, type SwingDominantHand, type SwingPose2DFrame, type SwingViewAngle } from "../data/schema";

type SwingKeypointName = SwingPose2DFrame["keypoints"][number]["name"];

const viewAngleOptions: Array<{ value: SwingViewAngle; label: { ko: string; en: string } }> = [
  { value: "down-the-line", label: { ko: "후방", en: "Down the line" } },
  { value: "face-on", label: { ko: "정면", en: "Face on" } },
];

const dominantHandOptions: Array<{ value: SwingDominantHand; label: { ko: string; en: string } }> = [
  { value: "right", label: { ko: "오른손", en: "Right" } },
  { value: "left", label: { ko: "왼손", en: "Left" } },
];

const skeletonSegments: Array<[SwingKeypointName, SwingKeypointName]> = [
  ["head", "neck"],
  ["left_shoulder", "right_shoulder"],
  ["left_shoulder", "left_elbow"],
  ["left_elbow", "left_wrist"],
  ["right_shoulder", "right_elbow"],
  ["right_elbow", "right_wrist"],
  ["left_shoulder", "left_hip"],
  ["right_shoulder", "right_hip"],
  ["left_hip", "right_hip"],
  ["left_hip", "left_knee"],
  ["left_knee", "left_ankle"],
  ["right_hip", "right_knee"],
  ["right_knee", "right_ankle"],
];

function phaseLabel(value: string) {
  const labels: Record<string, string> = {
    address: "Address",
    takeaway: "Takeaway",
    backswing_top: "Top",
    downswing: "Downswing",
    impact: "Impact",
    follow_through: "Follow",
    finish: "Finish",
  };
  return labels[value] ?? value;
}

function keypointMap(frame: SwingPose2DFrame) {
  return new Map(frame.keypoints.map((point) => [point.name, point]));
}

function SkeletonOverlay({ frame }: { frame: SwingPose2DFrame }) {
  const points = keypointMap(frame);

  return (
    <svg className="swing-skeleton-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {skeletonSegments.map(([from, to]) => {
        const a = points.get(from);
        const b = points.get(to);
        if (!a || !b) return null;
        return <line className="swing-skeleton-line" key={`${from}-${to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
      })}
      {frame.club ? <line className="swing-club-line" x1={frame.club.grip.x} y1={frame.club.grip.y} x2={frame.club.head.x} y2={frame.club.head.y} /> : null}
      {frame.keypoints.map((point) => (
        <circle className="swing-skeleton-dot" cx={point.x} cy={point.y} key={point.name} r="1.25" />
      ))}
      {frame.club ? <circle className="swing-club-head" cx={frame.club.head.x} cy={frame.club.head.y} r="1.8" /> : null}
    </svg>
  );
}

function nearestFrame(result: SwingAnalysisResult | null, currentTime: number) {
  if (!result || result.pose2dFrames.length === 0) return null;
  const targetFrame = Math.round(currentTime * result.video.fps);
  return result.pose2dFrames.reduce((best, frame) => {
    return Math.abs(frame.frame - targetFrame) < Math.abs(best.frame - targetFrame) ? frame : best;
  }, result.pose2dFrames[0]);
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function SwingAiPage() {
  const { language } = useLanguage();
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState("");
  const [club, setClub] = useState<Club>("Driver");
  const [viewAngle, setViewAngle] = useState<SwingViewAngle>("down-the-line");
  const [dominantHand, setDominantHand] = useState<SwingDominantHand>("right");
  const [analysis, setAnalysis] = useState<SwingAnalysisResult | null>(null);
  const [status, setStatus] = useState<"idle" | "queued" | "running" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!videoFile) {
      setVideoPreviewUrl("");
      return;
    }

    const url = URL.createObjectURL(videoFile);
    setVideoPreviewUrl(url);
    setCurrentTime(0);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  const frame = nearestFrame(analysis, currentTime);
  const scoreRows = useMemo(
    () =>
      analysis
        ? [
            { label: "Overall", value: analysis.scores.overall },
            { label: "Setup", value: analysis.scores.setup },
            { label: "Backswing", value: analysis.scores.backswing },
            { label: "Impact", value: analysis.scores.impact },
            { label: "Balance", value: analysis.scores.balance },
          ]
        : [],
    [analysis],
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!videoFile) {
      setError(text(language, "분석할 스윙 영상을 선택해주세요.", "Select a swing video."));
      return;
    }

    const parsed = newSwingAnalysisSchema.safeParse({
      videoName: videoFile.name,
      videoSizeBytes: videoFile.size,
      club,
      viewAngle,
      dominantHand,
    });
    if (!parsed.success) {
      setError(text(language, "영상 정보와 분석 조건을 다시 확인해주세요.", "Check the video details and analysis options."));
      return;
    }

    try {
      setStatus("running");
      setAnalysis(null);
      setProgress(0);
      setCurrentStage("");
      const response = await createSwingAnalysis({ ...parsed.data, videoFile });
      setProgress(response.progress ?? 0);
      setCurrentStage(response.currentStage ?? response.status);

      if (response.result) {
        setAnalysis(response.result);
        setProgress(100);
        setStatus("done");
        return;
      }

      setStatus(response.status === "queued" ? "queued" : "running");
      for (let attempt = 0; attempt < 180; attempt += 1) {
        await sleep(1000);
        const statusResponse = await fetchSwingAnalysisStatus(response.analysisId);
        setProgress(statusResponse.progress ?? 0);
        setCurrentStage(statusResponse.currentStage ?? statusResponse.status);

        if (statusResponse.status === "failed") {
          throw new Error(statusResponse.error || "analysis_failed");
        }
        if (statusResponse.status === "completed") {
          const resultResponse = await fetchSwingAnalysis(response.analysisId);
          setAnalysis(resultResponse.result);
          setProgress(100);
          setStatus("done");
          return;
        }
        setStatus(statusResponse.status === "queued" ? "queued" : "running");
      }

      throw new Error("analysis_timeout");
    } catch {
      setStatus("idle");
      setError(text(language, "분석 결과를 저장하지 못했습니다. 로컬 API 상태를 확인해주세요.", "Could not save the analysis result. Check the local API."));
    }
  };

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Swing AI</p>
          <h1>{text(language, "스윙 AI", "Swing AI")}</h1>
          <p>{text(language, "스윙 영상 기준으로 자세, 구간, 추천을 한 화면에서 확인합니다.", "Review posture, phases, and recommendations from a swing video.")}</p>
        </div>
        <Chip tone="accent">{status === "running" || status === "queued" ? `${progress}%` : status === "done" ? "Result" : "Ready"}</Chip>
      </header>

      <div className="swing-ai-grid">
        <form className="form-stack" onSubmit={submit}>
          <Card>
            <div className="card-title-row">
              <div>
                <p className="card-kicker">Input</p>
                <h2>{text(language, "스윙 영상", "Swing Video")}</h2>
              </div>
              <Upload size={18} />
            </div>
            <div className="form-grid">
              <label className="field">
                {text(language, "영상 파일", "Video File")}
                <input accept="video/*" onChange={(event) => setVideoFile(event.target.files?.[0] ?? null)} type="file" />
              </label>
              <label className="field">
                {text(language, "클럽", "Club")}
                <select onChange={(event) => setClub(event.target.value as Club)} value={club}>
                  {CLUBS.map((item) => (
                    <option key={item} value={item}>
                      {clubLabel(item, language)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                {text(language, "촬영 각도", "Camera Angle")}
                <select onChange={(event) => setViewAngle(event.target.value as SwingViewAngle)} value={viewAngle}>
                  {viewAngleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label[language]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                {text(language, "주 사용 손", "Dominant Hand")}
                <select onChange={(event) => setDominantHand(event.target.value as SwingDominantHand)} value={dominantHand}>
                  {dominantHandOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label[language]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Card>

          {error ? <div className="form-error">{error}</div> : null}

          <div className="save-row">
            <Button disabled={status === "running" || status === "queued"} type="submit">
              <Play size={16} />
              {status === "running" || status === "queued" ? text(language, "분석 중", "Analyzing") : text(language, "분석 시작", "Start Analysis")}
            </Button>
          </div>
        </form>

        <Card className="swing-preview-card">
          <div className="card-title-row">
            <div>
              <p className="card-kicker">Overlay</p>
              <h2>{analysis ? analysis.input.videoName : text(language, "분석 프레임", "Analysis Frame")}</h2>
            </div>
            <Chip>{frame ? `${frame.frame}f` : text(language, "대기", "Idle")}</Chip>
          </div>
          <div className="swing-video-frame">
            {videoPreviewUrl ? (
              <video controls muted onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} playsInline src={videoPreviewUrl} />
            ) : (
              <div className="swing-video-placeholder">{text(language, "영상을 선택하세요", "Select a video")}</div>
            )}
            {frame ? <SkeletonOverlay frame={frame} /> : null}
          </div>
          {status === "running" || status === "queued" ? <div className="swing-analysis-status">{currentStage || status}</div> : null}
        </Card>
      </div>

      {analysis ? (
        <>
          <div className="swing-score-grid">
            {scoreRows.map((row) => (
              <div key={row.label}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>

          <div className="swing-result-grid">
            <Card>
              <div className="card-title-row">
                <div>
                  <p className="card-kicker">Features</p>
                  <h2>{text(language, "바이오메카닉 요약", "Biomechanics Summary")}</h2>
                </div>
                <Activity size={18} />
              </div>
              <div className="swing-feature-list">
                <div><span>Tempo</span><strong>{analysis.features.tempoRatio.toFixed(1)}:1</strong></div>
                <div><span>Shoulder Turn</span><strong>{analysis.features.shoulderTurnDeg}deg</strong></div>
                <div><span>Hip Turn</span><strong>{analysis.features.hipTurnDeg}deg</strong></div>
                <div><span>X-Factor</span><strong>{analysis.features.xFactorDeg}deg</strong></div>
                <div><span>Head Sway</span><strong>{analysis.features.headSwayCm.toFixed(1)}cm</strong></div>
                <div><span>Club Path</span><strong>{analysis.features.clubPath}</strong></div>
              </div>
            </Card>

            <Card>
              <div className="card-title-row">
                <div>
                  <p className="card-kicker">Phases</p>
                  <h2>{text(language, "스윙 구간", "Swing Phases")}</h2>
                </div>
                <Chip>{analysis.phases.length}</Chip>
              </div>
              <div className="swing-phase-list">
                {analysis.phases.map((phase) => (
                  <div key={phase.name}>
                    <span>{phaseLabel(phase.name)}</span>
                    <strong>{phase.startFrame}-{phase.endFrame}f</strong>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="swing-recommendation-card">
            <div className="card-title-row">
              <div>
                <p className="card-kicker">Recommendations</p>
                <h2>{text(language, "추천", "Recommendations")}</h2>
              </div>
              <Chip tone="accent">{analysis.recommendations.length}</Chip>
            </div>
            <div className="swing-recommendation-list">
              {analysis.recommendations.map((recommendation) => (
                <article data-severity={recommendation.severity} key={recommendation.id}>
                  <div>
                    <span>{phaseLabel(recommendation.phase)} · {recommendation.value}</span>
                    <h3>{recommendation.title}</h3>
                    <p>{recommendation.detail}</p>
                    <p>{recommendation.drill}</p>
                  </div>
                </article>
              ))}
            </div>
          </Card>
        </>
      ) : null}
    </section>
  );
}
