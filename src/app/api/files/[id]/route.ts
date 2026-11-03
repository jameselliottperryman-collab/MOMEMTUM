import { NextRequest, NextResponse } from "next/server";
import { requestActor, ApiError, fail } from "@/lib/access";
import { readState, mutate } from "@/lib/store";
import { attachmentAccess, loadFile, discardFile } from "@/lib/files";
import { validateDocument } from "@/lib/features";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(req: NextRequest, ctx: Context) {
  try {
    const actor = requestActor(req);
    const { id } = await ctx.params;
    const s = readState(),
      f = s.attachments!.find((f) => f.id === id);
    if (!f) fail(404, "File unavailable.");
    attachmentAccess(s, f, actor);
    const bytes = await loadFile(id).catch(() =>
      fail(404, "File unavailable."),
    );
    const latest = readState();
    const current = latest.attachments!.find((x) => x.id === id);
    if (!current) fail(404, "File unavailable.");
    attachmentAccess(latest, current, actor);
    const inline =
      f.mime.startsWith("image/") && !req.nextUrl.searchParams.has("download");
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": f.mime,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${f.name.replace(/[^\x20-\x7e]|[";]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(f.name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof ApiError ? e.message : "File unavailable." },
      { status: e instanceof ApiError ? e.status : 500 },
    );
  }
}
export async function DELETE(req: NextRequest, ctx: Context) {
  try {
    const actor = requestActor(req, true),
      { id } = await ctx.params;
    mutate((s) => {
      const f = s.attachments!.find((f) => f.id === id);
      if (!f) fail(404, "File unavailable.");
      attachmentAccess(s, f, actor, "Edit");
      // Preserve images referenced by the document or its recovery history.
      if (
        f.documentId &&
        [
          s.documents!.find((d) => d.id === f.documentId)?.body,
          ...s
            .documentRevisions!.filter((r) => r.documentId === f.documentId)
            .map((r) => r.body),
        ].some(
          (body) => body && JSON.stringify(body).includes("/api/files/" + f.id),
        )
      )
        fail(
          409,
          "This image is used in a document or its history and must be kept for recovery.",
        );
      s.attachments = s.attachments!.filter((f) => f.id !== id);
    });
    await discardFile(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof ApiError ? e.message : "File could not be removed.",
      },
      { status: e instanceof ApiError ? e.status : 500 },
    );
  }
}
