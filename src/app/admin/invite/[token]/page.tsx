import { acceptInvite } from "@/app/admin/actions";
import { getAdminInviteByToken } from "@/services/admin-invites";

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await getAdminInviteByToken(token);
  const action = acceptInvite.bind(null, token);

  return (
    <main className="login-page">
      <form className="login-card" action={action}>
        <h1>초대 수락</h1>
        <p>{invite?.email ?? "초대 정보를 확인합니다."}</p>
        <label>
          이름
          <input name="name" required />
        </label>
        <label>
          비밀번호
          <input type="password" name="password" required minLength={8} />
        </label>
        <button type="submit">계정 만들기</button>
      </form>
    </main>
  );
}
