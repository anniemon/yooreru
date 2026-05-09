import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const hasDatabase = Boolean(process.env.DATABASE_URL);

export const prisma =
  globalForPrisma.prisma ??
  (hasDatabase
    ? new PrismaClient({
        adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
        log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
      })
    : null);
// 개발 환경에서는 한 번 만든 prisma client를 globalThis에 저장해서 hot reload후에도 재사용
if (process.env.NODE_ENV !== "production" && prisma) {
  globalForPrisma.prisma = prisma;
}

export function requirePrisma() {
  if (!prisma) {
    throw new Error("DATABASE_URL is required for this operation.");
  }

  return prisma;
}
