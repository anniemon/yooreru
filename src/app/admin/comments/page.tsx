import { moderateComment } from "@/app/admin/actions";
import { AdminShell } from "@/components/admin-shell";
import { requireAdmin } from "@/lib/auth";
import { getAdminComments } from "@/services/comments";

export default async function AdminCommentsPage() {
  await requireAdmin();
  const comments = await getAdminComments();

  return (
    <AdminShell>
      <div className="admin-heading">
        <div>
          <h1>댓글</h1>
          <p>공개 댓글을 숨김, 스팸, 대기 상태로 조정합니다.</p>
        </div>
      </div>
      <div className="admin-panel">
        <table className="admin-table">
          <thead>
            <tr>
              <th>작성자</th>
              <th>내용</th>
              <th>글</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {comments.map((comment) => (
              <tr key={comment.id}>
                <td>{comment.authorName}</td>
                <td>{comment.content}</td>
                <td>{comment.post.title}</td>
                <td>
                  <form action={moderateComment} className="inline-form">
                    <input type="hidden" name="id" value={comment.id} />
                    <select name="status" defaultValue={comment.status}>
                      <option value="PUBLISHED">PUBLISHED</option>
                      <option value="HIDDEN">HIDDEN</option>
                      <option value="SPAM">SPAM</option>
                      <option value="PENDING">PENDING</option>
                    </select>
                    <button type="submit">저장</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
