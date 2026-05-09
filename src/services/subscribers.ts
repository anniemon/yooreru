import "server-only";

import { SITE } from "@/lib/constants";
import { sendMail } from "@/lib/mail";
import { requirePrisma } from "@/lib/prisma";

export async function subscribeEmail(email: string) {
  const db = requirePrisma();
  const subscriber = await db.subscriber.upsert({
    where: { email },
    update: { status: "ACTIVE" },
    create: { email },
  });

  await sendMail({
    to: subscriber.email,
    subject: `${SITE.name} 구독이 등록되었습니다`,
    html: `<p>${SITE.name}의 새 글 알림을 받을 수 있습니다.</p>`,
  });

  return subscriber;
}
