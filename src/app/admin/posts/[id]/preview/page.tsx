import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostArticle } from "@/components/post-article";
import { SiteHeader } from "@/components/site";
import { requireAdmin } from "@/lib/auth";
import { getAdminPostForPreview } from "@/services/admin-posts";

export const metadata: Metadata = {
  title: "글 미리보기",
  robots: { index: false, follow: false },
};

export default async function PreviewPostPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isSafeInteger(postId) || postId <= 0) notFound();

  const post = await getAdminPostForPreview(postId);
  if (!post) notFound();

  return (
    <>
      <nav className="admin-preview-bar" aria-label="미리보기">
        <span>저장된 글 미리보기</span>
        <Link href={`/admin/posts/${post.id}/edit`}>글 수정</Link>
        <Link href="/admin">게시글 목록</Link>
      </nav>
      <SiteHeader />
      <PostArticle post={post} />
    </>
  );
}
