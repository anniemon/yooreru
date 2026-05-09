import { login } from "@/app/admin/actions";

export default function AdminLoginPage() {
  return (
    <main className="login-page">
      <form className="login-card" action={login}>
        <h1>yooreru admin</h1>
        <label>
          이메일
          <input type="email" name="email" required autoComplete="email" />
        </label>
        <label>
          비밀번호
          <input type="password" name="password" required autoComplete="current-password" />
        </label>
        <button type="submit">로그인</button>
      </form>
    </main>
  );
}
