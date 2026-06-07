import Link from "next/link";
import { createInvite } from "@/app/admin/actions";
import { AdminShell } from "@/components/admin-shell";
import { requireAdmin } from "@/lib/auth";
import { isDatabaseConfigured } from "@/services/database";
import { getAdminPostList } from "@/services/admin-posts";
import { postHref } from "@/services/content";

export default async function AdminPage() {
  await requireAdmin();
  const posts = await getAdminPostList();
  const hasDatabase = isDatabaseConfigured();

  return (
    <AdminShell>
      <div className="admin-heading">
        <div>
          <h1>게시글</h1>
          <p>발행, 초안, 예약 글을 관리합니다.</p>
        </div>
        <Link className="admin-button" href="/admin/posts/new">
          새 글
        </Link>
      </div>
      {!hasDatabase ? (
        <div className="admin-panel">
          <strong>DATABASE_URL이 없습니다.</strong>
          <p>현재 어드민 UI는 확인할 수 있지만 저장 작업은 DB 연결 후 동작합니다.</p>
        </div>
      ) : null}
      <div className="admin-panel">
        <table className="admin-table">
          <thead>
            <tr>
              <th>제목</th>
              <th>상태</th>
              <th>댓글</th>
              <th>수정</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id}>
                <td>
                  <Link href={postHref(post)}>{post.title}</Link>
                </td>
                <td>{post.status}</td>
                <td>{post._count.comments}</td>
                <td>
                  <Link href={`/admin/posts/${post.id}/edit`}>열기</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div id="invites" className="admin-panel">
        <h2>관리자 초대</h2>
        <form className="form-grid invite-form" action={createInvite}>
          <label>
            이메일
            <input type="email" name="email" required />
          </label>
          <label>
            권한
            <select name="role" defaultValue="AUTHOR">
              <option value="AUTHOR">AUTHOR</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </label>
          <button type="submit">초대 보내기</button>
        </form>
      </div>
    </AdminShell>
  );
}
