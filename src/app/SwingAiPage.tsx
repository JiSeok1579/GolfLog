import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Activity, Crosshair, History, Play, RotateCcw, Save, SlidersHorizontal, Sparkles, Upload } from "lucide-react";
import { AnalysisQualityBadge, qualityForAnalysis } from "../components/swing-ai/AnalysisQualityBadge";
import { CaptureGuideCard } from "../components/swing-ai/CaptureGuideCard";
import { CoachSummaryCard } from "../components/swing-ai/CoachSummaryCard";
import { HistoricalComparisonCard } from "../components/swing-ai/HistoricalComparisonCard";
import { RecommendationCards } from "../components/swing-ai/RecommendationCards";
import { ScoreBreakdownGrid } from "../components/swing-ai/ScoreBreakdownGrid";
import { SkeletonOverlay } from "../components/swing-ai/SkeletonOverlay";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Chip } from "../components/ui/Chip";
import {
  createSwingAnalysis,
  fetchSwingAnalyses,
  fetchSwingAnalysis,
  fetchSwingAnalysisStatus,
  swingAnalysisVideoUrl,
  updateSwingAnalysisClub,
  updateSwingAnalysisPhases,
  type SwingAnalysisListItem,
} from "../data/api";
import { CLUBS, clubLabel } from "../data/clubs";
import { text, useLanguage } from "../data/i18n";
import { newSwingAnalysisSchema, type Club, type SwingAnalysisResult, type SwingDominantHand, type SwingPhase, type SwingPose2DFrame, type SwingViewAngle } from "../data/schema";

type SwingPoint = NonNullable<SwingPose2DFrame["club"]>["grip"];
type ClubDraft = {
  frame: number;
  grip: SwingPoint;
  head: SwingPoint;
};

const viewAngleOptions: Array<{ value: SwingViewAngle; label: { ko: string; en: string } }> = [
  { value: "down-the-line", label: { ko: "후방", en: "Down the line" } },
  { value: "face-on", label: { ko: "정면", en: "Face on" } },
];

const dominantHandOptions: Array<{ value: SwingDominantHand; label: { ko: string; en: string } }> = [
  { value: "right", label: { ko: "오른손", en: "Right" } },
  { value: "left", label: { ko: "왼손", en: "Left" } },
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

function nearestFrame(result: SwingAnalysisResult | null, currentTime: number) {
  if (!result || result.pose2dFrames.length === 0) return null;
  const targetFrame = Math.round(currentTime * result.video.fps);
  return result.pose2dFrames.reduce((best, frame) => {
    return Math.abs(frame.frame - targetFrame) < Math.abs(best.frame - targetFrame) ? frame : best;
  }, result.pose2dFrames[0]);
}

function maxAnalysisFrame(result: SwingAnalysisResult) {
  const phaseMax = result.phases.reduce((best, phase) => Math.max(best, phase.endFrame), 0);
  const poseMax = result.pose2dFrames.reduce((best, poseFrame) => Math.max(best, poseFrame.frame), 0);
  return Math.max(1, phaseMax, poseMax, Math.round(result.video.durationSec * result.video.fps));
}

function phaseStartPercent(result: SwingAnalysisResult, startFrame: number) {
  return Math.max(0, Math.min(100, (startFrame / maxAnalysisFrame(result)) * 100));
}

function currentPhaseName(result: SwingAnalysisResult | null, currentTime: number, phases?: SwingPhase[]) {
  if (!result) return "";
  const targetFrame = Math.round(currentTime * result.video.fps);
  return (phases || result.phases).find((phase) => targetFrame >= phase.startFrame && targetFrame <= phase.endFrame)?.name ?? "";
}

function formatAnalysisDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(date);
}

function clampFrame(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function clampPercent(value: number) {
  return Number(Math.max(0, Math.min(100, value)).toFixed(2));
}

function clubDraftFromFrame(frame: SwingPose2DFrame | null): ClubDraft | null {
  if (!frame) return null;
  const fallbackGrip = frame.keypoints.find((point) => point.name === "right_wrist") || frame.keypoints.find((point) => point.name === "left_wrist");
  const fallbackHead = fallbackGrip ? { x: clampPercent(fallbackGrip.x + 18), y: clampPercent(fallbackGrip.y + 18) } : { x: 50, y: 50 };
  return {
    frame: frame.frame,
    grip: {
      x: clampPercent(frame.club?.grip.x ?? fallbackGrip?.x ?? 50),
      y: clampPercent(frame.club?.grip.y ?? fallbackGrip?.y ?? 50),
    },
    head: {
      x: clampPercent(frame.club?.head.x ?? fallbackHead.x),
      y: clampPercent(frame.club?.head.y ?? fallbackHead.y),
    },
  };
}

function pointChanged(a: SwingPoint, b?: SwingPoint) {
  if (!b) return true;
  return Math.abs(a.x - b.x) > 0.01 || Math.abs(a.y - b.y) > 0.01;
}

function phaseFingerprint(phases: SwingPhase[]) {
  return phases.map((phase) => `${phase.name}:${phase.startFrame}:${phase.endFrame}`).join("|");
}

function withPhaseTimes(phases: SwingPhase[], fps: number) {
  return phases.map((phase) => ({
    ...phase,
    timeSec: Number((phase.startFrame / Math.max(fps, 1)).toFixed(3)),
  }));
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function SwingAiPage() {
  const { language } = useLanguage();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [localVideoPreviewUrl, setLocalVideoPreviewUrl] = useState("");
  const [historyVideoUrl, setHistoryVideoUrl] = useState("");
  const [club, setClub] = useState<Club>("Driver");
  const [viewAngle, setViewAngle] = useState<SwingViewAngle>("down-the-line");
  const [dominantHand, setDominantHand] = useState<SwingDominantHand>("right");
  const [analysis, setAnalysis] = useState<SwingAnalysisResult | null>(null);
  const [phaseDraft, setPhaseDraft] = useState<SwingPhase[] | null>(null);
  const [phaseSaving, setPhaseSaving] = useState(false);
  const [phaseError, setPhaseError] = useState("");
  const [clubDraft, setClubDraft] = useState<ClubDraft | null>(null);
  const [clubSaving, setClubSaving] = useState(false);
  const [clubError, setClubError] = useState("");
  const [analysisHistory, setAnalysisHistory] = useState<SwingAnalysisListItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "queued" | "running" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!videoFile) {
      setLocalVideoPreviewUrl("");
      return;
    }

    const url = URL.createObjectURL(videoFile);
    setHistoryVideoUrl("");
    setLocalVideoPreviewUrl(url);
    setCurrentTime(0);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  const refreshAnalysisHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await fetchSwingAnalyses();
      setAnalysisHistory(response.analyses);
    } catch {
      setAnalysisHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    void refreshAnalysisHistory();
  }, []);

  useEffect(() => {
    setPhaseDraft(analysis ? analysis.phases : null);
    setPhaseError("");
  }, [analysis]);

  const videoPreviewUrl = localVideoPreviewUrl || historyVideoUrl;
  const frame = nearestFrame(analysis, currentTime);
  const clubDraftChanged = Boolean(
    frame && clubDraft && clubDraft.frame === frame.frame && (pointChanged(clubDraft.grip, frame.club?.grip) || pointChanged(clubDraft.head, frame.club?.head)),
  );
  const displayPhases = phaseDraft || analysis?.phases || [];
  const phaseDraftChanged = Boolean(analysis && phaseDraft && phaseFingerprint(analysis.phases) !== phaseFingerprint(phaseDraft));
  const activePhaseName = currentPhaseName(analysis, currentTime, phaseDraft || undefined);
  const analysisQuality = analysis ? qualityForAnalysis(analysis) : null;
  const scoreUnavailable = Boolean(analysisQuality?.isFallback);
  const scoreRows = useMemo(
    () =>
      analysis
        ? [
            { label: "Overall", value: scoreUnavailable ? "N/A" : analysis.scores.overall },
            { label: "Setup", value: scoreUnavailable ? "N/A" : analysis.scores.setup },
            { label: "Backswing", value: scoreUnavailable ? "N/A" : analysis.scores.backswing },
            { label: "Impact", value: scoreUnavailable ? "N/A" : analysis.scores.impact },
            { label: "Balance", value: scoreUnavailable ? "N/A" : analysis.scores.balance },
          ]
        : [],
    [analysis, scoreUnavailable],
  );

  useEffect(() => {
    setClubDraft(clubDraftFromFrame(frame));
    setClubError("");
  }, [analysis?.id, frame?.frame]);

  const seekToFrame = (targetFrame: number) => {
    if (!analysis) return;
    const seconds = targetFrame / Math.max(analysis.video.fps, 1);
    const video = videoRef.current;
    if (video) {
      const videoDuration = Number.isFinite(video.duration) ? video.duration : seconds;
      video.currentTime = Math.max(0, Math.min(seconds, videoDuration));
    }
    setCurrentTime(seconds);
  };

  const seekToPhase = (phaseName: string) => {
    const phase = displayPhases.find((item) => item.name === phaseName) || analysis?.phases.find((item) => item.name === phaseName);
    if (phase) seekToFrame(phase.startFrame);
  };

  const updatePhaseBoundary = (index: number, field: "startFrame" | "endFrame", rawValue: string) => {
    if (!analysis) return;
    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue)) return;

    setPhaseDraft((current) => {
      const source = current || analysis.phases;
      const next = source.map((phase) => ({ ...phase }));
      const phase = next[index];
      if (!phase) return source;

      if (field === "startFrame") {
        if (index === 0) return source;
        const previous = next[index - 1];
        const value = clampFrame(numericValue, previous.startFrame + 1, phase.endFrame);
        previous.endFrame = value - 1;
        phase.startFrame = value;
      } else {
        if (index === next.length - 1) return source;
        const following = next[index + 1];
        const value = clampFrame(numericValue, phase.startFrame, following.endFrame - 1);
        phase.endFrame = value;
        following.startFrame = value + 1;
      }

      return withPhaseTimes(next, analysis.video.fps);
    });
  };

  const updateClubDraft = (point: "grip" | "head", axis: "x" | "y", rawValue: string) => {
    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue)) return;
    setClubDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        [point]: {
          ...current[point],
          [axis]: clampPercent(numericValue),
        },
      };
    });
  };

  const resetClubDraft = () => {
    setClubDraft(clubDraftFromFrame(frame));
    setClubError("");
  };

  const saveClubDraft = async () => {
    if (!analysis || !frame || !clubDraft || !clubDraftChanged) return;
    setClubSaving(true);
    setClubError("");
    try {
      const response = await updateSwingAnalysisClub(analysis.id, {
        club: {
          grip: clubDraft.grip,
          head: clubDraft.head,
          score: 1,
        },
        frame: clubDraft.frame,
      });
      setAnalysis(response.result);
      setClubDraft(clubDraftFromFrame(nearestFrame(response.result, currentTime)));
      void refreshAnalysisHistory();
    } catch {
      setClubError(text(language, "클럽 보정을 저장하지 못했습니다.", "Could not save club edits."));
    } finally {
      setClubSaving(false);
    }
  };

  const resetPhaseDraft = () => {
    if (!analysis) return;
    setPhaseDraft(analysis.phases);
    setPhaseError("");
  };

  const savePhaseDraft = async () => {
    if (!analysis || !phaseDraft || !phaseDraftChanged) return;
    setPhaseSaving(true);
    setPhaseError("");
    try {
      const response = await updateSwingAnalysisPhases(analysis.id, phaseDraft);
      setAnalysis(response.result);
      setPhaseDraft(response.result.phases);
      void refreshAnalysisHistory();
    } catch {
      setPhaseError(text(language, "구간 보정을 저장하지 못했습니다.", "Could not save phase edits."));
    } finally {
      setPhaseSaving(false);
    }
  };

  const loadAnalysisResult = async (item: SwingAnalysisListItem) => {
    if (item.status !== "completed") return;
    setError("");
    try {
      const response = await fetchSwingAnalysis(item.id);
      setVideoFile(null);
      setHistoryVideoUrl(item.hasVideo ? swingAnalysisVideoUrl(item.id) : "");
      setAnalysis(response.result);
      setCurrentTime(0);
      setProgress(100);
      setCurrentStage("completed");
      setStatus("done");
    } catch {
      setError(text(language, "분석 결과를 불러오지 못했습니다.", "Could not load the analysis result."));
    }
  };

  const createSampleAnalysis = async () => {
    setError("");
    const parsed = newSwingAnalysisSchema.safeParse({
      club,
      dominantHand,
      videoName: "sample-swing-analysis",
      viewAngle,
    });
    if (!parsed.success) {
      setError(text(language, "분석 조건을 다시 확인해주세요.", "Check the analysis options."));
      return;
    }

    try {
      setStatus("running");
      setVideoFile(null);
      setHistoryVideoUrl("");
      setAnalysis(null);
      setCurrentTime(0);
      setProgress(0);
      setCurrentStage("sample");
      const response = await createSwingAnalysis(parsed.data);
      if (response.result) {
        setAnalysis(response.result);
        setProgress(100);
        setCurrentStage("completed");
        setStatus("done");
        void refreshAnalysisHistory();
        return;
      }
      throw new Error("sample_analysis_failed");
    } catch {
      setStatus("idle");
      setError(text(language, "예시 분석을 생성하지 못했습니다.", "Could not create the sample analysis."));
    }
  };

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
      setHistoryVideoUrl("");
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
        void refreshAnalysisHistory();
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
          void refreshAnalysisHistory();
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

      {analysis ? <CoachSummaryCard analysis={analysis} language={language} /> : null}

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
                <input
                  accept="video/*"
                  onChange={(event) => {
                    setAnalysis(null);
                    setHistoryVideoUrl("");
                    setVideoFile(event.target.files?.[0] ?? null);
                  }}
                  type="file"
                />
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

          <CaptureGuideCard analysis={analysis} language={language} />

          {error ? <div className="form-error">{error}</div> : null}

          <div className="save-row">
            <Button disabled={status === "running" || status === "queued"} onClick={createSampleAnalysis} type="button" variant="secondary">
              <Sparkles size={16} />
              {text(language, "예시 분석", "Sample")}
            </Button>
            <Button disabled={status === "running" || status === "queued"} type="submit">
              <Play size={16} />
              {status === "running" || status === "queued" ? text(language, "분석 중", "Analyzing") : text(language, "분석 시작", "Start Analysis")}
            </Button>
          </div>

          <Card className="swing-history-card">
            <div className="card-title-row">
              <div>
                <p className="card-kicker">{text(language, "기록", "History")}</p>
                <h2>{text(language, "최근 분석", "Recent Analyses")}</h2>
              </div>
              <History size={18} />
            </div>
            <div className="swing-history-list">
              {analysisHistory.length > 0 ? (
                analysisHistory.map((item) => (
                  <button
                    className={analysis?.id === item.id ? "swing-history-row is-active" : "swing-history-row"}
                    disabled={item.status !== "completed"}
                    key={item.id}
                    onClick={() => loadAnalysisResult(item)}
                    type="button"
                  >
                    <span>
                      <strong>{item.input.videoName}</strong>
                      <small>{formatAnalysisDate(item.updatedAt || item.createdAt)} · {clubLabel(item.input.club, language)}</small>
                    </span>
                    <Chip tone={item.hasVideo ? "accent" : undefined}>
                      {item.analysisQuality?.isFallback ? "N/A" : item.status === "completed" ? item.scores?.overall ?? "OK" : item.status}
                    </Chip>
                  </button>
                ))
              ) : (
                <div className="swing-history-empty">{historyLoading ? text(language, "불러오는 중", "Loading") : text(language, "기록 없음", "No records")}</div>
              )}
            </div>
          </Card>
        </form>

        <Card className="swing-preview-card">
          <div className="card-title-row">
            <div>
              <p className="card-kicker">Overlay</p>
              <h2>{analysis ? analysis.input.videoName : text(language, "분석 프레임", "Analysis Frame")}</h2>
            </div>
            <Chip>{frame ? `${frame.frame}f` : text(language, "대기", "Idle")}</Chip>
          </div>
          {analysis ? <AnalysisQualityBadge analysis={analysis} language={language} /> : null}
          <div className="swing-video-frame">
            {videoPreviewUrl ? (
              <video
                controls
                muted
                onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                playsInline
                ref={videoRef}
                src={videoPreviewUrl}
              />
            ) : (
              <div className="swing-video-placeholder">{text(language, "영상을 선택하세요", "Select a video")}</div>
            )}
            {frame ? <SkeletonOverlay frame={frame} /> : null}
          </div>
          {analysis ? (
            <div aria-label="Swing phase timeline" className="swing-phase-timeline">
              {displayPhases.map((phase) => (
                <button
                  aria-label={`${phaseLabel(phase.name)} ${phase.startFrame} frame`}
                  className={`swing-phase-marker${activePhaseName === phase.name ? " is-active" : ""}`}
                  key={phase.name}
                  onClick={() => seekToFrame(phase.startFrame)}
                  style={{ left: `${phaseStartPercent(analysis, phase.startFrame)}%` }}
                  title={`${phaseLabel(phase.name)} ${phase.startFrame}f`}
                  type="button"
                />
              ))}
            </div>
          ) : null}
          {status === "running" || status === "queued" ? <div className="swing-analysis-status">{currentStage || status}</div> : null}
        </Card>
      </div>

      {analysis ? (
        <>
          <div className="swing-score-grid">
            {scoreRows.map((row) => (
              <div data-unavailable={scoreUnavailable ? "true" : undefined} key={row.label}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
          {scoreUnavailable ? <p className="swing-score-note">Score unavailable for fallback analysis</p> : null}

          <ScoreBreakdownGrid analysis={analysis} language={language} />
          <HistoricalComparisonCard analysis={analysis} language={language} />

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
                <div><span>Shoulder Turn Proxy</span><strong>{analysis.features.shoulderTurnDeg}deg</strong></div>
                <div><span>Hip Turn Proxy</span><strong>{analysis.features.hipTurnDeg}deg</strong></div>
                <div><span>X-Factor Proxy</span><strong>{analysis.features.xFactorDeg}deg</strong></div>
                <div><span>Head Sway Proxy</span><strong>{analysis.features.headSwayCm.toFixed(1)}%</strong></div>
                <div><span>Address Spine Proxy</span><strong>{analysis.features.spineAngleDeg}deg</strong></div>
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
                {displayPhases.map((phase) => (
                  <button
                    className={`swing-phase-row${activePhaseName === phase.name ? " is-active" : ""}`}
                    key={phase.name}
                    onClick={() => seekToFrame(phase.startFrame)}
                    type="button"
                  >
                    <span>{phaseLabel(phase.name)}</span>
                    <strong>{phase.startFrame}-{phase.endFrame}f</strong>
                  </button>
                ))}
              </div>
            </Card>
          </div>

          <RecommendationCards analysis={analysis} language={language} onViewPhase={seekToPhase} phaseLabel={phaseLabel} />

          <section className="swing-advanced-tools">
            <div className="swing-section-heading">
              <p className="card-kicker">Advanced Correction</p>
              <h2>{text(language, "고급 보정 도구", "Advanced Correction Tools")}</h2>
            </div>

            <Card className="swing-phase-editor-card">
              <div className="card-title-row">
                <div>
                  <p className="card-kicker">Phase Edit</p>
                  <h2>{text(language, "구간 보정", "Phase Adjustment")}</h2>
                </div>
                <SlidersHorizontal size={18} />
              </div>
              <div className="swing-phase-editor-list">
                {displayPhases.map((phase, index) => (
                  <div className="swing-phase-editor-row" key={phase.name}>
                    <button
                      className={`swing-phase-editor-seek${activePhaseName === phase.name ? " is-active" : ""}`}
                      onClick={() => seekToFrame(phase.startFrame)}
                      type="button"
                    >
                      <span>{phaseLabel(phase.name)}</span>
                      <small>{phase.timeSec.toFixed(2)}s</small>
                    </button>
                    <label>
                      <span>Start</span>
                      <input
                        disabled={index === 0 || phaseSaving}
                        inputMode="numeric"
                        max={phase.endFrame}
                        min={index === 0 ? 0 : displayPhases[index - 1].startFrame + 1}
                        onChange={(event) => updatePhaseBoundary(index, "startFrame", event.target.value)}
                        type="number"
                        value={phase.startFrame}
                      />
                    </label>
                    <label>
                      <span>End</span>
                      <input
                        disabled={index === displayPhases.length - 1 || phaseSaving}
                        inputMode="numeric"
                        max={index === displayPhases.length - 1 ? maxAnalysisFrame(analysis) : displayPhases[index + 1].endFrame - 1}
                        min={phase.startFrame}
                        onChange={(event) => updatePhaseBoundary(index, "endFrame", event.target.value)}
                        type="number"
                        value={phase.endFrame}
                      />
                    </label>
                  </div>
                ))}
              </div>
              {phaseError ? <div className="form-error">{phaseError}</div> : null}
              <div className="swing-phase-editor-actions">
                <Button disabled={!phaseDraftChanged || phaseSaving} onClick={resetPhaseDraft} type="button" variant="ghost">
                  <RotateCcw size={16} />
                  {text(language, "초기화", "Reset")}
                </Button>
                <Button disabled={!phaseDraftChanged || phaseSaving} onClick={savePhaseDraft} type="button">
                  <Save size={16} />
                  {phaseSaving ? text(language, "저장 중", "Saving") : text(language, "저장", "Save")}
                </Button>
              </div>
            </Card>

            <Card className="swing-club-editor-card">
              <div className="card-title-row">
                <div>
                  <p className="card-kicker">Club Edit</p>
                  <h2>{text(language, "클럽 보정", "Club Adjustment")}</h2>
                </div>
                <Crosshair size={18} />
              </div>
              {frame && clubDraft ? (
                <>
                  <div className="swing-club-editor-grid">
                    <button className="swing-club-editor-frame" onClick={() => seekToFrame(frame.frame)} type="button">
                      <span>Frame</span>
                      <strong>{frame.frame}f</strong>
                    </button>
                    <label>
                      <span>Grip X</span>
                      <input
                        disabled={clubSaving}
                        inputMode="decimal"
                        max={100}
                        min={0}
                        onChange={(event) => updateClubDraft("grip", "x", event.target.value)}
                        step={0.1}
                        type="number"
                        value={clubDraft.grip.x}
                      />
                    </label>
                    <label>
                      <span>Grip Y</span>
                      <input
                        disabled={clubSaving}
                        inputMode="decimal"
                        max={100}
                        min={0}
                        onChange={(event) => updateClubDraft("grip", "y", event.target.value)}
                        step={0.1}
                        type="number"
                        value={clubDraft.grip.y}
                      />
                    </label>
                    <label>
                      <span>Head X</span>
                      <input
                        disabled={clubSaving}
                        inputMode="decimal"
                        max={100}
                        min={0}
                        onChange={(event) => updateClubDraft("head", "x", event.target.value)}
                        step={0.1}
                        type="number"
                        value={clubDraft.head.x}
                      />
                    </label>
                    <label>
                      <span>Head Y</span>
                      <input
                        disabled={clubSaving}
                        inputMode="decimal"
                        max={100}
                        min={0}
                        onChange={(event) => updateClubDraft("head", "y", event.target.value)}
                        step={0.1}
                        type="number"
                        value={clubDraft.head.y}
                      />
                    </label>
                  </div>
                  {clubError ? <div className="form-error">{clubError}</div> : null}
                  <div className="swing-club-editor-actions">
                    <Button disabled={!clubDraftChanged || clubSaving} onClick={resetClubDraft} type="button" variant="ghost">
                      <RotateCcw size={16} />
                      {text(language, "초기화", "Reset")}
                    </Button>
                    <Button disabled={!clubDraftChanged || clubSaving} onClick={saveClubDraft} type="button">
                      <Save size={16} />
                      {clubSaving ? text(language, "저장 중", "Saving") : text(language, "저장", "Save")}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="swing-history-empty">{text(language, "보정할 프레임 없음", "No frame to edit")}</div>
              )}
            </Card>
          </section>
        </>
      ) : null}
    </section>
  );
}
