import { z } from "zod";
import { CLUBS } from "./clubs";

export const clubSchema = z.enum(CLUBS);

export const sessionTypeSchema = z.enum(["range", "screen", "round", "practice", "lesson"]);

export const userProfileSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
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
export type AppData = z.infer<typeof appDataSchema>;

export type NewSessionInput = z.infer<typeof newSessionSchema>;
export type NewClubShotInput = z.infer<typeof newClubShotSchema>;
export type NewHealthEntryInput = z.infer<typeof newHealthEntrySchema>;
export type ProfileInput = z.infer<typeof profileInputSchema>;
