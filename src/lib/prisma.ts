import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const hasDatabase = Boolean(process.env.DATABASE_URL);

export function getPrisma() {
  if (!hasDatabase) {
    return null;
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }

  return globalForPrisma.prisma;
}

export function requirePrisma() {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("DATABASE_URL is required for this operation.");
  }

  return prisma;
}
