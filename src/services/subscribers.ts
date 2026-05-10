import "server-only";

import { SITE } from "@/lib/constants";
import { sendMail } from "@/lib/mail";
import { requirePrisma } from "@/lib/prisma";

export async function subscribeEmail(email: string) {
  const db = requirePrisma();
  const existing = await db.subscriber.findUnique({ where: { email } });

  if (existing?.status === "ACTIVE") {
    return { subscriber: existing, alreadySubscribed: true };
  }

  const subscriber = existing
    ? await db.subscriber.update({
        where: { id: existing.id },
        data: { status: "ACTIVE" },
      })
    : await db.subscriber.create({ data: { email } });

  await sendMail({
    to: subscriber.email,
    subject: `${SITE.name} 구독이 등록되었습니다`,
    html: `<p>${SITE.name}의 새 글 알림을 받을 수 있습니다.</p>`,
  });

  return { subscriber, alreadySubscribed: false };
}
