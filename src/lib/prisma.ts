import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL!;
  // Managed Postgres (Supabase/Railway) requires SSL; a local or CI Postgres
  // doesn't speak it and pg errors out if SSL is forced. Detect localhost and
  // skip SSL there so the same code runs in dev, CI, and production.
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString ?? "");
  const pool = new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 10,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
