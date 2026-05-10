export type BlogCategory = {
  id: number;
  name: string;
  slug: string;
  description: string;
  parentSlug?: string;
  postCount: number;
};

export type BlogTag = {
  id: number;
  name: string;
  slug: string;
  postCount: number;
};

export type BlogComment = {
  id: number;
  postId: number;
  parentId: number | null;
  authorName: string;
  authorEmailHash?: string;
  content: string;
  createdAt: Date;
  children?: BlogComment[];
};

export type BlogPost = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  contentHtml: string;
  featuredImageUrl?: string | null;
  publishedAt: Date | null;
  allowComments: boolean;
  categories: BlogCategory[];
  tags: BlogTag[];
  comments?: BlogComment[];
};
