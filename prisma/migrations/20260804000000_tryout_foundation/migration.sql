-- Tryout & Draft foundation. Active only when leagues.usesTryoutDraft is true.

-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('REGISTERED', 'DRAFTED');
CREATE TYPE "TryoutRunMode" AS ENUM ('BY_SKILL', 'BY_PLAYER');
CREATE TYPE "TryoutStatus" AS ENUM ('SETUP', 'LIVE', 'DONE');

-- AlterTable: config flag + prerequisites
ALTER TABLE "leagues"    ADD COLUMN "usesTryoutDraft" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "categories" ADD COLUMN "minAge" INTEGER;
ALTER TABLE "categories" ADD COLUMN "maxAge" INTEGER;
ALTER TABLE "seasons"    ADD COLUMN "ageCutoffDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "category_admins" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "category_admins_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "category_admins_categoryId_userId_key" ON "category_admins"("categoryId", "userId");
CREATE INDEX "category_admins_userId_idx" ON "category_admins"("userId");

CREATE TABLE "prospects" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "dob" TIMESTAMP(3),
    "photoUrl" TEXT,
    "nationality" TEXT,
    "status" "ProspectStatus" NOT NULL DEFAULT 'REGISTERED',
    "playerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "prospects_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "prospects_playerId_key" ON "prospects"("playerId");
CREATE INDEX "prospects_seasonId_categoryId_idx" ON "prospects"("seasonId", "categoryId");

CREATE TABLE "tryouts" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "fieldId" TEXT,
    "ratingMin" INTEGER NOT NULL DEFAULT 1,
    "ratingMax" INTEGER NOT NULL DEFAULT 5,
    "runMode" "TryoutRunMode",
    "status" "TryoutStatus" NOT NULL DEFAULT 'SETUP',
    "currentParticipantId" TEXT,
    "currentSkillId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tryouts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tryouts_seasonId_categoryId_idx" ON "tryouts"("seasonId", "categoryId");

CREATE TABLE "tryout_skills" (
    "id" TEXT NOT NULL,
    "tryoutId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "tryout_skills_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tryout_skills_tryoutId_idx" ON "tryout_skills"("tryoutId");

CREATE TABLE "tryout_evaluators" (
    "id" TEXT NOT NULL,
    "tryoutId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attendanceConfirmed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "tryout_evaluators_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tryout_evaluators_tryoutId_userId_key" ON "tryout_evaluators"("tryoutId", "userId");

CREATE TABLE "tryout_participants" (
    "id" TEXT NOT NULL,
    "tryoutId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL DEFAULT 0,
    "attendanceConfirmed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "tryout_participants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tryout_participants_tryoutId_prospectId_key" ON "tryout_participants"("tryoutId", "prospectId");
CREATE INDEX "tryout_participants_tryoutId_idx" ON "tryout_participants"("tryoutId");

CREATE TABLE "tryout_scores" (
    "id" TEXT NOT NULL,
    "tryoutId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tryout_scores_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tryout_scores_participantId_skillId_evaluatorId_key" ON "tryout_scores"("participantId", "skillId", "evaluatorId");
CREATE INDEX "tryout_scores_tryoutId_idx" ON "tryout_scores"("tryoutId");

-- Foreign keys
ALTER TABLE "category_admins" ADD CONSTRAINT "category_admins_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "category_admins" ADD CONSTRAINT "category_admins_userId_fkey"     FOREIGN KEY ("userId")     REFERENCES "users"("id")      ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "prospects" ADD CONSTRAINT "prospects_leagueId_fkey"   FOREIGN KEY ("leagueId")   REFERENCES "leagues"("id")    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_seasonId_fkey"   FOREIGN KEY ("seasonId")   REFERENCES "seasons"("id")    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_playerId_fkey"   FOREIGN KEY ("playerId")   REFERENCES "players"("id")    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tryouts" ADD CONSTRAINT "tryouts_seasonId_fkey"   FOREIGN KEY ("seasonId")   REFERENCES "seasons"("id")    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tryouts" ADD CONSTRAINT "tryouts_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tryouts" ADD CONSTRAINT "tryouts_fieldId_fkey"    FOREIGN KEY ("fieldId")    REFERENCES "fields"("id")     ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tryout_skills" ADD CONSTRAINT "tryout_skills_tryoutId_fkey" FOREIGN KEY ("tryoutId") REFERENCES "tryouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tryout_evaluators" ADD CONSTRAINT "tryout_evaluators_tryoutId_fkey" FOREIGN KEY ("tryoutId") REFERENCES "tryouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tryout_evaluators" ADD CONSTRAINT "tryout_evaluators_userId_fkey"   FOREIGN KEY ("userId")   REFERENCES "users"("id")   ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tryout_participants" ADD CONSTRAINT "tryout_participants_tryoutId_fkey"   FOREIGN KEY ("tryoutId")   REFERENCES "tryouts"("id")   ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tryout_participants" ADD CONSTRAINT "tryout_participants_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tryout_scores" ADD CONSTRAINT "tryout_scores_tryoutId_fkey"      FOREIGN KEY ("tryoutId")      REFERENCES "tryouts"("id")             ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tryout_scores" ADD CONSTRAINT "tryout_scores_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "tryout_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tryout_scores" ADD CONSTRAINT "tryout_scores_skillId_fkey"       FOREIGN KEY ("skillId")       REFERENCES "tryout_skills"("id")       ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tryout_scores" ADD CONSTRAINT "tryout_scores_evaluatorId_fkey"   FOREIGN KEY ("evaluatorId")   REFERENCES "tryout_evaluators"("id")   ON DELETE CASCADE ON UPDATE CASCADE;
