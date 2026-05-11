import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { normalizeSlug } from "../src/lib/slug";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const posts = await prisma.post.findMany({
    select: {
      id: true,
      title: true,
      slug: true,
    },
    orderBy: { id: "asc" },
  });

  let updated = 0;

  for (const post of posts) {
    const slug = normalizeSlug(post.slug || post.title);
    if (!slug || slug === post.slug) {
      continue;
    }

    await prisma.post.update({
      where: { id: post.id },
      data: { slug },
    });
    updated += 1;
    console.log(`${post.id}: ${post.slug} -> ${slug}`);
  }

  console.log(`Normalized ${updated} of ${posts.length} post slugs.`);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
