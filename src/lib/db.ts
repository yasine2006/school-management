import type { PrismaClient } from "@prisma/client";
import { createPrisma } from "@/lib/prisma";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  globalForPrisma.prisma = createPrisma();
  return globalForPrisma.prisma;
}

export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const prisma = getPrisma();
    const value = (prisma as any)[prop];
    if (typeof value === "function") {
      return value.bind(prisma);
    }
    return value;
  },
}) as PrismaClient;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = getPrisma();
