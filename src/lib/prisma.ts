import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Railway exposes the DB under several possible variable names depending on
// how the PostgreSQL service is linked. Try all of them.
function getDatabaseUrl(): string {
  const url =
    process.env.DATABASE_URL ||
    process.env.DATABASE_PRIVATE_URL ||
    process.env.DATABASE_PUBLIC_URL ||
    process.env.POSTGRES_URL;

  if (!url) {
    throw new Error(
      "No database URL found. Set one of: DATABASE_URL, DATABASE_PRIVATE_URL, DATABASE_PUBLIC_URL, POSTGRES_URL"
    );
  }
  return url;
}

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: getDatabaseUrl() });
  return new PrismaClient({ adapter, log: ["error"] });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
