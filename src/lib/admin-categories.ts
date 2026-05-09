import { prisma } from "@/lib/prisma";

export type AdminCategory = {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  description: string;
  postCount: number;
};

export async function getAdminCategories(): Promise<AdminCategory[]> {
  if (!prisma) {
    return [];
  }

  const categories = await prisma.category.findMany({
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
