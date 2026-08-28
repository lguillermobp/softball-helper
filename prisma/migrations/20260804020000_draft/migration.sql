-- Draft: assigns prospects to teams within a season-category.

CREATE TABLE "drafts" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SETUP',
    "snake" BOOLEAN NOT NULL DEFAULT true,
    "targetPerTeam" INTEGER,
    "pickOrder" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "currentPick" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "drafts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "drafts_seasonId_categoryId_key" ON "drafts"("seasonId", "categoryId");

CREATE TABLE "draft_picks" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 0,
    "pickNumber" INTEGER NOT NULL DEFAULT 0,
    "isKeeper" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "draft_picks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "draft_picks_draftId_prospectId_key" ON "draft_picks"("draftId", "prospectId");
CREATE INDEX "draft_picks_draftId_idx" ON "draft_picks"("draftId");

ALTER TABLE "drafts" ADD CONSTRAINT "drafts_seasonId_fkey"   FOREIGN KEY ("seasonId")   REFERENCES "seasons"("id")    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_draftId_fkey"    FOREIGN KEY ("draftId")    REFERENCES "drafts"("id")    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_teamId_fkey"     FOREIGN KEY ("teamId")     REFERENCES "teams"("id")     ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
