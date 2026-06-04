-- Add re-entry rules to Season
ALTER TABLE "seasons" ADD COLUMN IF NOT EXISTS "reEntryAllowed" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "seasons" ADD COLUMN IF NOT EXISTS "reEntryLimit" INTEGER NOT NULL DEFAULT 1;

-- Add official scoring fields to Game
ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);
ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "lineupsLocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;

-- Create AtBatOutcome enum
CREATE TYPE "AtBatOutcome" AS ENUM ('SINGLE', 'DOUBLE', 'TRIPLE', 'HOME_RUN', 'WALK', 'OUT', 'STRIKEOUT');

-- Create game_at_bats
CREATE TABLE "game_at_bats" (
  "id"           TEXT NOT NULL,
  "gameId"       TEXT NOT NULL,
  "inningNumber" INTEGER NOT NULL,
  "isTop"        BOOLEAN NOT NULL,
  "batterId"     TEXT NOT NULL,
  "pitcherId"    TEXT NOT NULL,
  "outcome"      "AtBatOutcome" NOT NULL,
  "sequence"     INTEGER NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "game_at_bats_pkey" PRIMARY KEY ("id")
);

-- Create game_innings
CREATE TABLE "game_innings" (
  "id"           TEXT NOT NULL,
  "gameId"       TEXT NOT NULL,
  "inningNumber" INTEGER NOT NULL,
  "isTop"        BOOLEAN NOT NULL,
  "runsScored"   INTEGER NOT NULL DEFAULT 0,
  "completed"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "game_innings_pkey" PRIMARY KEY ("id")
);

-- Create game_pitcher_stints
CREATE TABLE "game_pitcher_stints" (
  "id"          TEXT NOT NULL,
  "gameId"      TEXT NOT NULL,
  "pitcherId"   TEXT NOT NULL,
  "isHome"      BOOLEAN NOT NULL,
  "inningStart" INTEGER NOT NULL,
  "isTopStart"  BOOLEAN NOT NULL,
  "outsAtStart" INTEGER NOT NULL DEFAULT 0,
  "inningEnd"   INTEGER,
  "isTopEnd"    BOOLEAN,
  "outsAtEnd"   INTEGER,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "game_pitcher_stints_pkey" PRIMARY KEY ("id")
);

-- Create game_substitutions
CREATE TABLE "game_substitutions" (
  "id"               TEXT NOT NULL,
  "gameId"           TEXT NOT NULL,
  "teamId"           TEXT NOT NULL,
  "inningNumber"     INTEGER NOT NULL,
  "isTop"            BOOLEAN NOT NULL,
  "playerInId"       TEXT NOT NULL,
  "playerOutId"      TEXT NOT NULL,
  "battingOrderSpot" INTEGER NOT NULL,
  "position"         TEXT,
  "isReEntry"        BOOLEAN NOT NULL DEFAULT false,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "game_substitutions_pkey" PRIMARY KEY ("id")
);

-- Foreign keys: game_at_bats
ALTER TABLE "game_at_bats" ADD CONSTRAINT "game_at_bats_gameId_fkey"    FOREIGN KEY ("gameId")    REFERENCES "games"("id")   ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_at_bats" ADD CONSTRAINT "game_at_bats_batterId_fkey"  FOREIGN KEY ("batterId")  REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "game_at_bats" ADD CONSTRAINT "game_at_bats_pitcherId_fkey" FOREIGN KEY ("pitcherId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign keys: game_innings
ALTER TABLE "game_innings" ADD CONSTRAINT "game_innings_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_innings" ADD CONSTRAINT "game_innings_gameId_inningNumber_isTop_key" UNIQUE ("gameId", "inningNumber", "isTop");

-- Foreign keys: game_pitcher_stints
ALTER TABLE "game_pitcher_stints" ADD CONSTRAINT "game_pitcher_stints_gameId_fkey"    FOREIGN KEY ("gameId")    REFERENCES "games"("id")   ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_pitcher_stints" ADD CONSTRAINT "game_pitcher_stints_pitcherId_fkey" FOREIGN KEY ("pitcherId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign keys: game_substitutions
ALTER TABLE "game_substitutions" ADD CONSTRAINT "game_substitutions_gameId_fkey"      FOREIGN KEY ("gameId")      REFERENCES "games"("id")   ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_substitutions" ADD CONSTRAINT "game_substitutions_playerInId_fkey"  FOREIGN KEY ("playerInId")  REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "game_substitutions" ADD CONSTRAINT "game_substitutions_playerOutId_fkey" FOREIGN KEY ("playerOutId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
