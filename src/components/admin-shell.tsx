import Link from "next/link";
import { FileText, FolderTree, LogOut, MessageSquare, Plus, Users } from "lucide-react";
import { logout } from "@/app/admin/actions";
import { getSessionUser } from "@/lib/auth";

export async function AdminShell({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/admin" className="admin-brand">
          yooreru admin
        </Link>
        <nav>
          <Link href="/admin">
            <FileText size={16} />
            게시글
          </Link>
          <Link href="/admin/posts/new">
            <Plus size={16} />새 글
          </Link>
          <Link href="/admin/comments">
            <MessageSquare size={16} />
            댓글
          </Link>
          <Link href="/admin/categories">
            <FolderTree size={16} />
            카테고리
          </Link>
          <Link href="/admin#invites">
            <Users size={16} />
            초대
          </Link>
        </nav>
        {user ? (
          <form action={logout}>
            <button type="submit">
              <LogOut size={16} />
              로그아웃
            </button>
          </form>
        ) : null}
      </aside>
      <section className="admin-content">{children}</section>
    </main>
  );
}
