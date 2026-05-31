import "server-only";

import { Resend } from "resend";
import { SITE } from "./constants";

let resend: Resend | null | undefined;

function getResend() {
  if (resend === undefined) {
    resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  }

  return resend;
}

export async function sendMail({
  to,
  subject,
  html,
}: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  const client = getResend();
  if (!client) {
    console.info("[mail:dry-run]", { to, subject });
    return { id: "dry-run" };
  }

  return client.emails.send({
    from: process.env.RESEND_FROM || `${SITE.name} <no-reply@yooreru.com>`,
    to,
    subject,
    html,
  });
}
