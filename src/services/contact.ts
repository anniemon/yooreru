import "server-only";

import { SITE } from "@/lib/constants";
import { sendMail } from "@/lib/mail";
import { requirePrisma } from "@/lib/prisma";

export type SendContactMessageInput = {
  senderName: string;
  senderEmail?: string;
  message: string;
};

export async function saveContactMessage(input: SendContactMessageInput) {
  const db = requirePrisma();
  const message = await db.contactMessage.create({
    data: {
      senderName: input.senderName,
      senderEmail: input.senderEmail ?? null,
      message: input.message,
    },
  });

  if (process.env.ADMIN_EMAIL) {
    const sender = message.senderEmail ? `${message.senderName} &lt;${message.senderEmail}&gt;` : message.senderName;

    await sendMail({
      to: process.env.ADMIN_EMAIL,
      subject: `${SITE.name} 메시지`,
      html: `<p><strong>${sender}</strong></p><p>${message.message.replace(/\n/g, "<br />")}</p>`,
    });
  }

  return message;
}
