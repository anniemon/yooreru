import "server-only";

import bcrypt from "bcryptjs";
import { getPrisma } from "@/lib/prisma";

export async function authenticateUser(email: string, password: string) {
  const db = getPrisma();
  if (!db) {
    return null;
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    return null;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return null;
  }

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
