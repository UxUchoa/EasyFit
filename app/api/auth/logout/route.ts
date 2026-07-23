import { NextResponse, type NextRequest } from "next/server";
import { revokeCurrentSession } from "@/lib/auth/session";
import { hasTrustedOrigin } from "@/lib/security/request";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  }
  await revokeCurrentSession();
  return NextResponse.json({ next: "/entrar" });
}
