-- Create conditions table
CREATE TABLE "conditions" (
    "id"          TEXT NOT NULL,
    "leagueId"    TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "content"     TEXT,
    "fileUrl"     TEXT,
    "fileName"    TEXT,
    "fileType"    TEXT,
    "order"       INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conditions_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_leagueId_fkey"
  FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conditions" ADD CONSTRAINT "conditions_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
