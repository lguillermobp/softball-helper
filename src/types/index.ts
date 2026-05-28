export type LeagueRole = "LEAGUE_ADMIN" | "UMPIRE" | "SCOREKEEPER" | "TEAM_MANAGER" | "PLAYER";

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  isMasterAdmin: boolean;
}

export interface LeagueContext {
  leagueId: string;
  leagueName: string;
  role: LeagueRole;
}

export interface RegistrationStep {
  step: number;
  title: string;
  description: string;
}

export const REGISTRATION_STEPS: RegistrationStep[] = [
  { step: 1, title: "Create Account", description: "Your personal details" },
  { step: 2, title: "League Setup", description: "Name and plan" },
  { step: 3, title: "Seasons", description: "Set up your first season" },
  { step: 4, title: "Categories", description: "Divisions and age groups" },
  { step: 5, title: "Teams", description: "Add your first teams" },
];
