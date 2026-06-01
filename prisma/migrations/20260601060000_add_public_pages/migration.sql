-- CreateTable
CREATE TABLE "league_public_pages" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "showStandings" BOOLEAN NOT NULL DEFAULT true,
    "showSchedule" BOOLEAN NOT NULL DEFAULT true,
    "showTeams" BOOLEAN NOT NULL DEFAULT true,
    "socialLinks" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "league_public_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_public_pages" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "showRoster" BOOLEAN NOT NULL DEFAULT true,
    "showStats" BOOLEAN NOT NULL DEFAULT true,
    "showSchedule" BOOLEAN NOT NULL DEFAULT true,
    "socialLinks" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_public_pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "league_public_pages_leagueId_key" ON "league_public_pages"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "team_public_pages_teamId_key" ON "team_public_pages"("teamId");

-- AddForeignKey
ALTER TABLE "league_public_pages" ADD CONSTRAINT "league_public_pages_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_public_pages" ADD CONSTRAINT "team_public_pages_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
