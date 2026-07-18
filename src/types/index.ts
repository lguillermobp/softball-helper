export type LeagueRole = "LEAGUE_ADMIN" | "UMPIRE" | "SCOREKEEPER" | "TEAM_MANAGER" | "TEAM_MANAGER_PLAYER" | "TEAM_ASSISTANT" | "TEAM_ASSISTANT_PLAYER" | "PLAYER";

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
  { step: 2, title: "League Setup",   description: "Name and location" },
  { step: 3, title: "Plan",           description: "Choose your plan" },
];
