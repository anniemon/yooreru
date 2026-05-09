import "server-only";

import { Resend } from "resend";
import { SITE } from "./constants";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendMail({
  to,
  subject,
  html,
}: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  if (!resend) {
    console.info("[mail:dry-run]", { to, subject });
    return { id: "dry-run" };
  }

  return resend.emails.send({
    from: process.env.RESEND_FROM || `${SITE.name} <no-reply@yooreru.com>`,
    to,
    subject,
    html,
  });
}
