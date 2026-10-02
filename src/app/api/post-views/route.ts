import { ViewSource } from "@/generated/prisma/enums";
import { getSessionUser } from "@/lib/auth";
import { recordPostView } from "@/services/content";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || !URL.canParse(origin) || new URL(origin).host !== request.headers.get("host")) {
    return new Response(null, { status: 403 });
  }

  const payload: unknown = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") return new Response(null, { status: 400 });
  const { postId, source } = payload as Record<string, unknown>;
  if (
    !Number.isSafeInteger(postId) ||
    (postId as number) <= 0 ||
    typeof source !== "string" ||
    !Object.values(ViewSource).includes(source as ViewSource)
  ) {
    return new Response(null, { status: 400 });
  }

  if (await getSessionUser()) return new Response(null, { status: 204 });
  const recorded = await recordPostView(postId as number, source as ViewSource);
  return new Response(null, { status: recorded ? 204 : 404 });
}
