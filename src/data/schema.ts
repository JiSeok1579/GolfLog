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

export const swingRecommendationSchema = z.object({
  id: z.string(),
  phase: swingPhaseNameSchema,
  severity: z.enum(["info", "warning", "risk"]),
  title: z.string(),
  detail: z.string(),
  drill: z.string(),
  metric: z.string(),
  value: z.string(),
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
  }),
  scores: z.object({
    overall: z.number().min(0).max(100),
    setup: z.number().min(0).max(100),
    backswing: z.number().min(0).max(100),
    impact: z.number().min(0).max(100),
    balance: z.number().min(0).max(100),
  }),
  recommendations: z.array(swingRecommendationSchema),
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
export type SwingPose2DFrame = z.infer<typeof swingPose2DFrameSchema>;
export type SwingRecommendation = z.infer<typeof swingRecommendationSchema>;
export type SwingAnalysisResult = z.infer<typeof swingAnalysisResultSchema>;
export type NewSwingAnalysisInput = z.infer<typeof newSwingAnalysisSchema>;
export type AppData = z.infer<typeof appDataSchema>;

export type NewSessionInput = z.infer<typeof newSessionSchema>;
export type NewClubShotInput = z.infer<typeof newClubShotSchema>;
export type NewHealthEntryInput = z.infer<typeof newHealthEntrySchema>;
export type ProfileInput = z.infer<typeof profileInputSchema>;
