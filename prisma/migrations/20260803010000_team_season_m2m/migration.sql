-- CreateTable: team ↔ season registration (a team plays in a division within a season)
CREATE TABLE "team_seasons" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "team_seasons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_seasons_seasonId_idx" ON "team_seasons"("seasonId");
CREATE INDEX "team_seasons_categoryId_idx" ON "team_seasons"("categoryId");
CREATE UNIQUE INDEX "team_seasons_teamId_seasonId_key" ON "team_seasons"("teamId", "seasonId");

-- AddForeignKey
ALTER TABLE "team_seasons" ADD CONSTRAINT "team_seasons_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_seasons" ADD CONSTRAINT "team_seasons_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_seasons" ADD CONSTRAINT "team_seasons_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: migrate each team's existing single season/category assignment into the join table
INSERT INTO "team_seasons" ("id", "teamId", "seasonId", "categoryId", "createdAt")
SELECT gen_random_uuid()::text, "id", "seasonId", "categoryId", CURRENT_TIMESTAMP
FROM "teams"
WHERE "seasonId" IS NOT NULL;

-- Drop the now-replaced single-value columns on teams
ALTER TABLE "teams" DROP CONSTRAINT IF EXISTS "teams_seasonId_fkey";
ALTER TABLE "teams" DROP CONSTRAINT IF EXISTS "teams_categoryId_fkey";
ALTER TABLE "teams" DROP COLUMN "seasonId";
ALTER TABLE "teams" DROP COLUMN "categoryId";
