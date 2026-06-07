import { AdminPostForm } from "@/components/admin-post-form";
import { AdminShell } from "@/components/admin-shell";
import { requireAdmin } from "@/lib/auth";
import { getAppTimeZone } from "@/lib/time-zone";
import { getAdminCategories } from "@/services/admin-categories";

export default async function NewPostPage() {
  await requireAdmin();
  const categories = await getAdminCategories();
  const timeZone = getAppTimeZone();

  return (
    <AdminShell>
      <div className="admin-heading">
        <div>
          <h1>새 글</h1>
          <p>본문은 블로그 에디터에서 작성하고, 저장 시 HTML로 보존됩니다.</p>
        </div>
      </div>
      <AdminPostForm categories={categories} timeZone={timeZone} />
    </AdminShell>
  );
}
