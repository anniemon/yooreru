import "server-only";

import { getPrisma, requirePrisma } from "@/lib/prisma";
import { normalizeSlug } from "@/lib/slug";

export type AdminCategory = {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  description: string;
  postCount: number;
};

export type SaveCategoryInput = {
  id: number | null;
  name: string;
  slug?: string;
  description?: string;
  parentId: number | null;
};

export async function getAdminCategories(): Promise<AdminCategory[]> {
  const db = getPrisma();
  if (!db) {
    return [];
  }

  const categories = await db.category.findMany({
    orderBy: [{ parentId: "asc" }, { name: "asc" }],
    include: { _count: { select: { posts: true } } },
  });

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    parentId: category.parentId,
    description: category.description,
    postCount: category._count.posts,
  }));
}

export async function saveAdminCategory(input: SaveCategoryInput) {
  const db = requirePrisma();
  const slug = normalizeSlug(input.slug || input.name) || input.name;
  const parentId = input.parentId && input.parentId !== input.id ? input.parentId : null;

  if (input.id) {
    return db.category.update({
      where: { id: input.id },
      data: {
        name: input.name,
        slug,
        description: input.description ?? "",
        parentId,
      },
    });
  }

  return db.category.create({
    data: {
      name: input.name,
      slug,
      description: input.description ?? "",
      parentId,
    },
  });
}

export async function deleteAdminCategory(id: number) {
  const db = requirePrisma();
  await db.category.delete({ where: { id } });
}
