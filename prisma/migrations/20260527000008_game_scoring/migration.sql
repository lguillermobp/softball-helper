-- CreateEnum
CREATE TYPE "OfficialRole" AS ENUM ('UMPIRE', 'SCOREKEEPER');

-- CreateTable
CREATE TABLE "game_officials" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OfficialRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "game_officials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_lineups" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "isHome" BOOLEAN NOT NULL,
    "position" TEXT NOT NULL,
    "battingOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "game_lineups_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "game_officials" ADD CONSTRAINT "game_officials_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_officials" ADD CONSTRAINT "game_officials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_lineups" ADD CONSTRAINT "game_lineups_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_lineups" ADD CONSTRAINT "game_lineups_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "game_officials_gameId_userId_key" ON "game_officials"("gameId", "userId");
CREATE UNIQUE INDEX "game_lineups_gameId_playerId_key" ON "game_lineups"("gameId", "playerId");
