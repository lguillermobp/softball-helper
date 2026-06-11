ALTER TABLE "game_innings" ADD COLUMN "carryOverBattingOrder" INTEGER;

CREATE TABLE "game_runner_outs" (
  "id"           TEXT NOT NULL,
  "gameId"       TEXT NOT NULL,
  "inningNumber" INTEGER NOT NULL,
  "isTop"        BOOLEAN NOT NULL,
  "sequence"     INTEGER NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "game_runner_outs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "game_runner_outs_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
