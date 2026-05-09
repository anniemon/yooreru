import "server-only";

import { SITE } from "@/lib/constants";
import { sendMail } from "@/lib/mail";
import { requirePrisma } from "@/lib/prisma";

export type SendContactMessageInput = {
  senderName: string;
  senderEmail: string;
  message: string;
};

export async function saveContactMessage(input: SendContactMessageInput) {
  const db = requirePrisma();
  const message = await db.contactMessage.create({
    data: {
      senderName: input.senderName,
      senderEmail: input.senderEmail,
      message: input.message,
    },
  });

  if (process.env.ADMIN_EMAIL) {
    await sendMail({
      to: process.env.ADMIN_EMAIL,
      subject: `${SITE.name} 메시지`,
      html: `<p><strong>${message.senderName}</strong> &lt;${message.senderEmail}&gt;</p><p>${message.message.replace(/\n/g, "<br />")}</p>`,
    });
  }

  return message;
}
