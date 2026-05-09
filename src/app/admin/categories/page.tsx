import { saveCategory, deleteCategory } from "@/app/admin/actions";
import { AdminShell } from "@/components/admin-shell";
import { getAdminCategories } from "@/lib/admin-categories";
import { requireAdmin } from "@/lib/auth";

export default async function AdminCategoriesPage() {
  await requireAdmin();
  const categories = await getAdminCategories();

  return (
    <AdminShell>
      <div className="admin-heading">
        <div>
          <h1>카테고리</h1>
          <p>글 분류를 추가, 삭제, 편집합니다.</p>
        </div>
      </div>

      <div className="admin-panel">
        <h2>새 카테고리</h2>
        <form className="form-grid category-form" action={saveCategory}>
          <label>
            이름
            <input name="name" required />
          </label>
          <label>
            슬러그
            <input name="slug" placeholder="비워두면 이름으로 생성" />
          </label>
          <label>
            상위 카테고리
            <select name="parentId" defaultValue="">
              <option value="">없음</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            설명
            <input name="description" />
          </label>
          <button type="submit">추가</button>
        </form>
      </div>

      <div className="admin-panel">
        <h2>카테고리 목록</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>이름</th>
              <th>슬러그</th>
              <th>상위</th>
              <th>글</th>
              <th>수정</th>
              <th>삭제</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => {
              const parent = category.parentId ? categories.find((item) => item.id === category.parentId) : null;

              return (
                <tr key={category.id}>
                  <td>{category.name}</td>
                  <td>{category.slug}</td>
                  <td>{parent?.name ?? "-"}</td>
                  <td>{category.postCount}</td>
                  <td>
                    <form className="inline-edit-form" action={saveCategory}>
                      <input type="hidden" name="id" value={category.id} />
                      <input name="name" defaultValue={category.name} aria-label="이름" required />
                      <input name="slug" defaultValue={category.slug} aria-label="슬러그" />
                      <select name="parentId" defaultValue={category.parentId ?? ""} aria-label="상위 카테고리">
                        <option value="">없음</option>
                        {categories
                          .filter((item) => item.id !== category.id)
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                      </select>
                      <input name="description" defaultValue={category.description} aria-label="설명" />
                      <button type="submit">저장</button>
                    </form>
                  </td>
                  <td>
                    <form action={deleteCategory}>
                      <input type="hidden" name="id" value={category.id} />
                      <button type="submit">삭제</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
