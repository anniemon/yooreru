import "server-only";

import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { SITE } from "@/lib/constants";
import { sendMail } from "@/lib/mail";
import { getPrisma, requirePrisma } from "@/lib/prisma";
import type { UserRole } from "@/generated/prisma/enums";

export type CreateInviteInput = {
  email: string;
  role: UserRole;
  invitedById: number;
};

export async function getAdminInviteByToken(token: string) {
  const db = getPrisma();
  if (!db) {
    return null;
  }

  return db.invite.findUnique({
    where: { token },
    select: { email: true },
  });
}

export async function createAdminInvite(input: CreateInviteInput) {
  const db = requirePrisma();
  const token = randomUUID();
  const invite = await db.invite.create({
    data: {
      email: input.email,
      role: input.role,
      token,
      invitedById: input.invitedById,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    },
  });

  await sendMail({
    to: invite.email,
    subject: `${SITE.name} 관리자 초대`,
    html: `<p>관리자 초대가 생성되었습니다.</p><p><a href="${SITE.url}/admin/invite/${invite.token}">초대 수락</a></p>`,
  });

  return invite;
}

export async function acceptAdminInvite({
  token,
  name,
  password,
}: {
  token: string;
  name: string;
  password: string;
}) {
  const db = requirePrisma();
  const invite = await db.invite.findUnique({ where: { token } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    throw new Error("유효하지 않은 초대입니다.");
  }

  const user = await db.user.create({
    data: {
      email: invite.email,
      name,
      passwordHash: await bcrypt.hash(password, 12),
      role: invite.role,
    },
  });

  await db.invite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() },
  });

  return user;
}
