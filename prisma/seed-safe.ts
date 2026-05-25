/**
 * Safe seed — runs on every deploy but only inserts if data doesn't exist yet.
 * Used in the Railway build pipeline.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Plans
  await prisma.plan.upsert({
    where: { name: "Free" },
    update: {},
    create: { name: "Free", price: 0, maxTeams: 4, maxSeasons: 1, maxPlayers: 40 },
  });
  await prisma.plan.upsert({
    where: { name: "Starter" },
    update: {},
    create: { name: "Starter", price: 29, maxTeams: 12, maxSeasons: 3, maxPlayers: 200 },
  });
  await prisma.plan.upsert({
    where: { name: "Pro" },
    update: {},
    create: { name: "Pro", price: 79, maxTeams: 9999, maxSeasons: 9999, maxPlayers: 9999 },
  });

  // Master admin
  const hashedPassword = await bcrypt.hash("admin1234!", 12);
  await prisma.user.upsert({
    where: { email: "admin@softballhelper.com" },
    update: {},
    create: {
      email: "admin@softballhelper.com",
      name: "Master Admin",
      password: hashedPassword,
      isMasterAdmin: true,
    },
  });

  console.log("✅ Seed complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
