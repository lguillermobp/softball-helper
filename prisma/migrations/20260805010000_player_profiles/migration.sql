-- CreateTable
CREATE TABLE "player_profiles" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dob" TIMESTAMP(3),
    "emails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_profiles_clubId_idx" ON "player_profiles"("clubId");

-- CreateTable
CREATE TABLE "profile_merges" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "survivorId" TEXT NOT NULL,
    "mergedName" TEXT NOT NULL,
    "mergedDob" TIMESTAMP(3),
    "mergedEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "movedPlayerIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "addedEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "setDob" BOOLEAN NOT NULL DEFAULT false,
    "undone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_merges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "profile_merges_clubId_idx" ON "profile_merges"("clubId");

-- CreateTable
CREATE TABLE "distinct_pairs" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "profile1" TEXT NOT NULL,
    "profile2" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "distinct_pairs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "distinct_pairs_clubId_profile1_profile2_key" ON "distinct_pairs"("clubId", "profile1", "profile2");

-- CreateIndex
CREATE INDEX "distinct_pairs_clubId_idx" ON "distinct_pairs"("clubId");

-- AlterTable
ALTER TABLE "players" ADD COLUMN "profileId" TEXT;

-- AddForeignKey
ALTER TABLE "player_profiles" ADD CONSTRAINT "player_profiles_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_merges" ADD CONSTRAINT "profile_merges_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distinct_pairs" ADD CONSTRAINT "distinct_pairs_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "player_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
