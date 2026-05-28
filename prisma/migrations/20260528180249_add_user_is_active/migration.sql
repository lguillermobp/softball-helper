-- DropForeignKey
ALTER TABLE "game_lineups" DROP CONSTRAINT "game_lineups_playerId_fkey";

-- AlterTable
ALTER TABLE "fields" ALTER COLUMN "types" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "game_lineups" ADD CONSTRAINT "game_lineups_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
