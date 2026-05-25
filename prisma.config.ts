import path from "node:path";
import { defineConfig } from "prisma/config";

// Railway PostgreSQL exposes several possible variable names
const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.DATABASE_PRIVATE_URL ||
  process.env.DATABASE_PUBLIC_URL ||
  process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.error(
    "❌  No database URL found. Checked: DATABASE_URL, DATABASE_PRIVATE_URL, DATABASE_PUBLIC_URL, POSTGRES_URL"
  );
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: databaseUrl,
  },
});
