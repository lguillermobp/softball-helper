-- AlterTable
ALTER TABLE "clubs" ADD COLUMN "subdomain" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "clubs_subdomain_key" ON "clubs"("subdomain");
