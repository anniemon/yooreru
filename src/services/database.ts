import "server-only";

import { hasDatabase } from "@/lib/prisma";

export function isDatabaseConfigured() {
  return hasDatabase;
}
