-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('MORNING', 'AFTERNOON', 'NIGHT');

-- AlterTable
ALTER TABLE "teams" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "fields" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "types" "FieldType"[] DEFAULT ARRAY[]::"FieldType"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fields_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "fields" ADD CONSTRAINT "fields_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
