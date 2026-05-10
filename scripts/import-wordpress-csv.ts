import "dotenv/config";

import { readFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

type CsvRecord = Record<string, string>;

const DEFAULT_FEEDBACK_CSV = "yooreru_feedback.csv";
const DEFAULT_SUBSCRIBERS_CSV = "yooreru-subscribers.csv";

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(field);
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((value) => value.length > 0)) {
    rows.push(row);
  }

  return rows;
}

async function readCsv(path: string): Promise<CsvRecord[]> {
  const csv = await readFile(path, "utf8");
  const rows = parseCsv(csv.replace(/^\uFEFF/, ""));
  const headers = rows[0]?.map((header) => header.trim()) ?? [];

  return rows.slice(1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? ""])),
  );
}

function parseWordPressDate(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    return new Date();
  }

  const date = new Date(`${trimmed.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid feedback date: ${input}`);
  }

  return date;
}

function subscriberStatus(input: string) {
  return input.trim().toLowerCase() === "subscribed" ? "ACTIVE" : "UNSUBSCRIBED";
}

function parseArgs() {
  const args = process.argv.slice(2);
  const getValue = (flag: string, fallback: string) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] ?? fallback : fallback;
  };

  return {
    feedbackCsv: getValue("--feedback", DEFAULT_FEEDBACK_CSV),
    subscribersCsv: getValue("--subscribers", DEFAULT_SUBSCRIBERS_CSV),
  };
}

async function importSubscribers(prisma: PrismaClient, path: string) {
  const rows = await readCsv(path);
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const email = row["이메일"] || row.Email || row.email;
    if (!email) {
      skipped += 1;
      continue;
    }

    await prisma.subscriber.upsert({
      where: { email: email.toLowerCase() },
      update: { status: subscriberStatus(row.Email_Subscriber ?? "") },
      create: {
        email: email.toLowerCase(),
        status: subscriberStatus(row.Email_Subscriber ?? ""),
      },
    });
    imported += 1;
  }

  return { imported, skipped };
}

async function importFeedback(prisma: PrismaClient, path: string) {
  const rows = await readCsv(path);
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const senderName = row.Name || "anonymous";
    const senderEmail = row.Email || null;
    const message = row.Message;
    const createdAt = parseWordPressDate(row["날짜"] ?? "");

    if (!message) {
      skipped += 1;
      continue;
    }

    const existing = await prisma.contactMessage.findFirst({
      where: {
        senderName,
        senderEmail,
        message,
        createdAt,
      },
      select: { id: true },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    await prisma.contactMessage.create({
      data: {
        senderName,
        senderEmail,
        message,
        createdAt,
      },
    });
    imported += 1;
  }

  return { imported, skipped };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const { feedbackCsv, subscribersCsv } = parseArgs();
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const subscribers = await importSubscribers(prisma, subscribersCsv);
    const feedback = await importFeedback(prisma, feedbackCsv);

    console.log(
      `Imported ${subscribers.imported} subscribers (${subscribers.skipped} skipped) and ${feedback.imported} contact messages (${feedback.skipped} skipped).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
