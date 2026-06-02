-- Add TEAM_MANAGER_PLAYER value to LeagueRole enum
ALTER TYPE "LeagueRole" ADD VALUE IF NOT EXISTS 'TEAM_MANAGER_PLAYER';

-- Add isActive column to players table
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
