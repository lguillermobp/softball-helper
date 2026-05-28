-- Add RESCHEDULED value to GameStatus enum
ALTER TYPE "GameStatus" ADD VALUE 'RESCHEDULED';

-- Add rescheduledFromId column to games
ALTER TABLE "games" ADD COLUMN "rescheduledFromId" TEXT;

-- Add FK constraint (SET NULL if original game is deleted)
ALTER TABLE "games" ADD CONSTRAINT "games_rescheduledFromId_fkey"
  FOREIGN KEY ("rescheduledFromId") REFERENCES "games"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
