-- Parent/guardian contacts on a prospect, for tryout & draft emails.
ALTER TABLE "prospects" ADD COLUMN "parent1Name"  TEXT;
ALTER TABLE "prospects" ADD COLUMN "parent1Email" TEXT;
ALTER TABLE "prospects" ADD COLUMN "parent1Phone" TEXT;
ALTER TABLE "prospects" ADD COLUMN "parent2Name"  TEXT;
ALTER TABLE "prospects" ADD COLUMN "parent2Email" TEXT;
ALTER TABLE "prospects" ADD COLUMN "parent2Phone" TEXT;
