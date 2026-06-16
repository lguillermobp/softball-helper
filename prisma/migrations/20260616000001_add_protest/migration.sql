CREATE TYPE "ProtestStatus" AS ENUM ('FILED', 'UPHELD', 'DENIED');

ALTER TABLE "games"
  ADD COLUMN "protestStatus"  "ProtestStatus",
  ADD COLUMN "protestTeamId"  TEXT,
  ADD COLUMN "protestComment" TEXT;
