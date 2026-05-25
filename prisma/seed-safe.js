/**
 * Plain JS seed — runs at startup via Railway's startCommand.
 * Uses upsert so it's safe to run on every deploy.
 */
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const bcrypt = require("bcryptjs");

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
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
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
