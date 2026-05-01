import { z } from "zod";
import { CLUBS } from "./clubs";

export const clubSchema = z.enum(CLUBS);

export const sessionTypeSchema = z.enum(["range", "screen", "round", "practice", "lesson"]);

export const userProfileSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  phone: z.string().optional(),
  heightCm: z.number().positive(),
  birthYear: z.number().int().optional(),
  distanceUnit: z.enum(["m", "yd"]),
  weightUnit: z.enum(["kg", "lb"]),
});

export const sessionSchema = z.object({
  id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: sessionTypeSchema,
  startTime: z.string().optional(),
  durationMinutes: z.number().int().nonnegative().optional(),
  location: z.string().optional(),
  ballsHit: z.number().int().nonnegative().optional(),
  condition: z.number().int().min(1).max(5).optional(),
  focus: z.number().int().min(1).max(5).optional(),
  feel: z.number().int().min(1).max(5).optional(),
  notes: z.string().optional(),
});

export const clubShotSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  club: clubSchema,
  carryM: z.number().positive().optional(),
  totalM: z.number().positive().optional(),
  ballSpeed: z.number().positive().optional(),
  headSpeed: z.number().positive().optional(),
  launchAngle: z.number().optional(),
  backspin: z.number().nonnegative().optional(),
  sidespin: z.number().optional(),
  sideDeviationM: z.number().optional(),
});

export const healthEntrySchema = z.object({
  id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weightKg: z.number().positive().optional(),
  sleepHours: z.number().nonnegative().optional(),
  systolic: z.number().int().positive().optional(),
  diastolic: z.number().int().positive().optional(),
  restingHr: z.number().int().positive().optional(),
});

export const swingViewAngleSchema = z.enum(["down-the-line", "face-on"]);
export const swingDominantHandSchema = z.enum(["right", "left"]);
export const swingAnalysisStatusSchema = z.enum(["queued", "processing", "completed", "failed"]);
export const swingPhaseNameSchema = z.enum(["address", "takeaway", "backswing_top", "downswing", "impact", "follow_through", "finish"]);
export const swingKeypointNameSchema = z.enum([
  "head",
  "neck",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
]);

const swingPoint2DSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
});

const swingScoreSchema = z.object({
  overall: z.number().min(0).max(100),
  setup: z.number().min(0).max(100),
  backswing: z.number().min(0).max(100),
  impact: z.number().min(0).max(100),
  balance: z.number().min(0).max(100),
});

const swingPhaseScoreSchema = z.object({
  address: z.number().min(0).max(100),
  takeaway: z.number().min(0).max(100),
  backswingTop: z.number().min(0).max(100),
  downswing: z.number().min(0).max(100),
  impact: z.number().min(0).max(100),
  followThrough: z.number().min(0).max(100),
  finish: z.number().min(0).max(100),
});

const swingBodyMovementScoreSchema = z.object({
  headStability: z.number().min(0).max(100),
  shoulderRotation: z.number().min(0).max(100),
  hipRotation: z.number().min(0).max(100),
  spineAngleMaintenance: z.number().min(0).max(100),
  armPath: z.number().min(0).max(100),
  weightShift: z.number().min(0).max(100),
  balance: z.number().min(0).max(100),
  tempo: z.number().min(0).max(100),
});

const swingScoreEvidenceInputSchema = z.object({
  label: z.string(),
  source: z.string().optional(),
  unit: z.string().optional(),
  value: z.union([z.number(), z.string()]),
});

const swingScoreEvidenceItemSchema = z.object({
  formula: z.string(),
  inputs: z.array(swingScoreEvidenceInputSchema),
  note: z.string().optional(),
  score: z.number().min(0).max(100).optional(),
});

const swingScoreEvidenceSchema = z.object({
  bodyMovementScores: z.record(z.string(), swingScoreEvidenceItemSchema).optional(),
  phaseScores: z.record(z.string(), swingScoreEvidenceItemSchema).optional(),
});

const swingPersonalizationReadinessSchema = z.object({
  status: z.enum(["insufficient", "limited", "sufficient"]),
  currentSampleSize: z.number().int().nonnegative(),
  requiredForLimited: z.number().int().positive(),
  requiredForSufficient: z.number().int().positive(),
  missingCountForNextLevel: z.number().int().nonnegative(),
  message: z.string(),
});

const swingHistoricalComparisonSchema = z.object({
  club: clubSchema,
  sampleSize: z.number().int().nonnegative(),
  baselineType: z.enum(["same-club-recent", "same-club-best", "insufficient-data"]),
  similarityScore: z.number().min(0).max(100).optional(),
  summary: z.string(),
  positiveMatches: z.array(z.string()),
  negativeMatches: z.array(z.string()),
  dataSufficiency: z.enum(["sufficient", "limited", "insufficient"]),
  personalizationReadiness: swingPersonalizationReadinessSchema.optional(),
  dateRange: z
    .object({
      start: z.string().optional(),
      end: z.string().optional(),
    })
    .optional(),
  metricsUsed: z.array(z.string()).optional(),
  recordsUsed: z
    .array(
      z.object({
        id: z.string(),
        sessionId: z.string(),
        date: z.string().optional(),
        carryM: z.number().optional(),
        totalM: z.number().optional(),
        sideDeviationM: z.number().optional(),
        headSpeed: z.number().optional(),
        launchAngle: z.number().optional(),
      }),
    )
    .optional(),
});

const swingRecommendationFollowUpSchema = z.object({
  recommendationId: z.string(),
  status: z.enum(["new", "practiced", "ignored"]),
  linkedFutureSessionIds: z.array(z.string()),
  beforeMetrics: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
  afterMetrics: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
  note: z.string().optional(),
});

export const swingKeypoint2DSchema = swingPoint2DSchema.extend({
  name: swingKeypointNameSchema,
  score: z.number().min(0).max(1),
});

export const swingPose2DFrameSchema = z.object({
  frame: z.number().int().nonnegative(),
  timeSec: z.number().nonnegative(),
  keypoints: z.array(swingKeypoint2DSchema),
  club: z
    .object({
      grip: swingPoint2DSchema,
      head: swingPoint2DSchema,
      score: z.number().min(0).max(1),
    })
    .optional(),
});

export const swingPhaseSchema = z.object({
  name: swingPhaseNameSchema,
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().nonnegative(),
  timeSec: z.number().nonnegative(),
});

export const swingAnalysisQualitySchema = z.object({
  runtime: z.enum(["mediapipe_solutions", "mediapipe_tasks", "fallback", "unknown"]),
  model: z.string(),
  isFallback: z.boolean(),
  poseConfidence: z.number().min(0).max(1),
  frameCount: z.number().int().nonnegative(),
  analyzedFrameCount: z.number().int().nonnegative(),
  droppedFrames: z.number().int().nonnegative(),
  clubDetectedFrames: z.number().int().nonnegative(),
  clubDetectionRate: z.number().min(0).max(1),
  warning: z.string().optional(),
});

export const swingRecommendationSchema = z.object({
  id: z.string(),
  phase: swingPhaseNameSchema,
  severity: z.enum(["info", "warning", "risk"]),
  title: z.string(),
  detail: z.string(),
  drill: z.string(),
  metric: z.string(),
  value: z.string(),
  evidenceMetrics: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
  overlayFrameRange: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]).optional(),
  reason: z.string().optional(),
  safetyNote: z.string().optional(),
  suggestion: z.string().optional(),
  confidence: z
    .object({
      level: z.enum(["high", "moderate", "low"]),
      reason: z.string(),
      score: z.number().min(0).max(100),
      signals: z
        .object({
          analyzedFrames: z.number().nonnegative().optional(),
          clubDetectedFrames: z.number().nonnegative().optional(),
          clubDetectionRate: z.number().min(0).max(1).optional(),
          poseConfidence: z.number().min(0).max(1).optional(),
        })
        .optional(),
    })
    .optional(),
});

export const swingAnalysisResultSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  status: swingAnalysisStatusSchema,
  input: z.object({
    videoName: z.string(),
    club: clubSchema,
    viewAngle: swingViewAngleSchema,
    dominantHand: swingDominantHandSchema,
  }),
  video: z.object({
    durationSec: z.number().positive(),
    fps: z.number().positive(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  phases: z.array(swingPhaseSchema),
  pose2dFrames: z.array(swingPose2DFrameSchema),
  features: z.object({
    tempoRatio: z.number(),
    shoulderTurnDeg: z.number(),
    hipTurnDeg: z.number(),
    xFactorDeg: z.number(),
    headSwayCm: z.number(),
    pelvisSwayCm: z.number(),
    spineAngleDeg: z.number(),
    clubPath: z.enum(["in-to-out", "neutral", "out-to-in"]),
    proxyMetrics: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
  }),
  analysisQuality: swingAnalysisQualitySchema.optional(),
  scores: swingScoreSchema,
  phaseScores: swingPhaseScoreSchema.optional(),
  bodyMovementScores: swingBodyMovementScoreSchema.optional(),
  scoreEvidence: swingScoreEvidenceSchema.optional(),
  historicalComparison: swingHistoricalComparisonSchema.optional(),
  recommendationFollowUps: z.array(swingRecommendationFollowUpSchema).optional(),
  recommendations: z.array(swingRecommendationSchema),
  metricBaselines: z
    .object({
      scores: swingScoreSchema,
    })
    .optional(),
});

export const newSwingAnalysisSchema = z.object({
  videoName: z.string().min(1),
  videoSizeBytes: z.number().nonnegative().optional(),
  club: clubSchema,
  viewAngle: swingViewAngleSchema,
  dominantHand: swingDominantHandSchema,
});

export const appDataSchema = z.object({
  profile: userProfileSchema,
  sessions: z.array(sessionSchema),
  clubShots: z.array(clubShotSchema),
  healthEntries: z.array(healthEntrySchema),
});

export const newSessionSchema = sessionSchema.omit({ id: true });
export const newClubShotSchema = clubShotSchema.omit({ id: true, sessionId: true });
export const newHealthEntrySchema = healthEntrySchema.omit({ id: true });
export const profileInputSchema = userProfileSchema.omit({ id: true });

export type Club = z.infer<typeof clubSchema>;
export type SessionType = z.infer<typeof sessionTypeSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type ClubShot = z.infer<typeof clubShotSchema>;
export type HealthEntry = z.infer<typeof healthEntrySchema>;
export type SwingViewAngle = z.infer<typeof swingViewAngleSchema>;
export type SwingDominantHand = z.infer<typeof swingDominantHandSchema>;
export type SwingAnalysisStatus = z.infer<typeof swingAnalysisStatusSchema>;
export type SwingPhaseName = z.infer<typeof swingPhaseNameSchema>;
export type SwingPhase = z.infer<typeof swingPhaseSchema>;
export type SwingAnalysisQuality = z.infer<typeof swingAnalysisQualitySchema>;
export type SwingPose2DFrame = z.infer<typeof swingPose2DFrameSchema>;
export type SwingRecommendation = z.infer<typeof swingRecommendationSchema>;
export type SwingPhaseScores = z.infer<typeof swingPhaseScoreSchema>;
export type SwingBodyMovementScores = z.infer<typeof swingBodyMovementScoreSchema>;
export type SwingScoreEvidence = z.infer<typeof swingScoreEvidenceSchema>;
export type SwingHistoricalComparison = z.infer<typeof swingHistoricalComparisonSchema>;
export type SwingPersonalizationReadiness = z.infer<typeof swingPersonalizationReadinessSchema>;
export type SwingRecommendationFollowUp = z.infer<typeof swingRecommendationFollowUpSchema>;
export type SwingAnalysisResult = z.infer<typeof swingAnalysisResultSchema>;
export type NewSwingAnalysisInput = z.infer<typeof newSwingAnalysisSchema>;
export type AppData = z.infer<typeof appDataSchema>;

export type NewSessionInput = z.infer<typeof newSessionSchema>;
export type NewClubShotInput = z.infer<typeof newClubShotSchema>;
export type NewHealthEntryInput = z.infer<typeof newHealthEntrySchema>;
export type ProfileInput = z.infer<typeof profileInputSchema>;
