import { notFound } from "next/navigation";
import { AdminPostForm } from "@/components/admin-post-form";
import { AdminShell } from "@/components/admin-shell";
import { requireAdmin } from "@/lib/auth";
import { getAppTimeZone } from "@/lib/time-zone";
import { getAdminCategories } from "@/services/admin-categories";
import { getAdminPostForEdit } from "@/services/admin-posts";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId) || postId <= 0) {
    notFound();
  }

  const categories = await getAdminCategories();
  const timeZone = getAppTimeZone();
  const post = await getAdminPostForEdit(postId);

  if (!post) {
    notFound();
  }

  const { postTags, ...formPost } = post;

  return (
    <AdminShell>
      <div className="admin-heading">
        <div>
          <h1>글 수정</h1>
          <p>{post.title}</p>
        </div>
      </div>
      <AdminPostForm
        post={{ ...formPost, tags: postTags.map((postTag) => postTag.tag) }}
        categories={categories}
        timeZone={timeZone}
      />
    </AdminShell>
  );
}
