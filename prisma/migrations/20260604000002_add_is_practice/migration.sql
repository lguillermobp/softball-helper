-- Add isPractice flag to games
ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "isPractice" BOOLEAN NOT NULL DEFAULT false;
