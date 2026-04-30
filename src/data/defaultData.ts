import type { AppData } from "./schema";
export { CLUBS, CLUB_GROUPS, clubGroupLabel, clubLabel } from "./clubs";


export function createInitialData(): AppData {
  return {
    profile: {
      id: "profile-jin",
      name: "진",
      phone: "",
      heightCm: 175,
      birthYear: 1991,
      distanceUnit: "m",
      weightUnit: "kg",
    },
    sessions: [],
    clubShots: [],
    healthEntries: [],
  };
}

export const initialData: AppData = createInitialData();
