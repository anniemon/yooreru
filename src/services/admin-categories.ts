import "server-only";

import { requirePrisma } from "@/lib/prisma";
import { normalizeSlug } from "@/lib/slug";

export type SaveCategoryInput = {
  id: number | null;
  name: string;
  slug?: string;
  description?: string;
  parentId: number | null;
};

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
