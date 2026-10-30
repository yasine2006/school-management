import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export function createPrisma() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    // During build time, return a dummy client to avoid build failures
    // The client will only be used at runtime when DATABASE_URL is set
    throw new Error("DATABASE_URL is not set");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
