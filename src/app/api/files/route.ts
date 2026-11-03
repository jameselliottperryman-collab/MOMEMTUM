import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  requestActor,
  task,
  document,
  ApiError,
  fail,
  str,
} from "@/lib/access";
import { readState, mutate } from "@/lib/store";
import {
  MAX_FILE,
  detectMime,
  saveFile,
  discardFile,
  attachmentAccess,
} from "@/lib/files";
import type { FileAttachment } from "@/lib/model";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  let created: string | undefined;
  try {
    const actor = requestActor(req, true);
    const max = MAX_FILE + 65536;
    if (Number(req.headers.get("content-length")) > max)
      fail(413, "Files must be smaller than 25 MB.");
    if (!req.headers.get("content-type")?.startsWith("multipart/form-data"))
      fail(415, "Choose a file to upload.");
    const reader = req.body?.getReader();
    if (!reader) fail(400, "Missing upload.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        fail(413, "Files must be smaller than 25 MB.");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const form = await new Request(req.url, {
      method: "POST",
      headers: { "Content-Type": req.headers.get("content-type")! },
      body: bytes,
    }).formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > MAX_FILE)
      fail(422, "Choose a non-empty file smaller than 25 MB.");
    const taskId =
        typeof form.get("taskId") === "string"
          ? String(form.get("taskId"))
          : "",
      documentId =
        typeof form.get("documentId") === "string"
          ? String(form.get("documentId"))
          : "";
    if (!!taskId === !!documentId)
      fail(422, "Attach a file to exactly one task or document.");
    const s = readState();
    const target = taskId
      ? task(s, taskId, actor, "Edit")
      : document(s, documentId, actor, "Edit");
    if ("archived" in target && target.archived)
      fail(403, "Restore this task before uploading.");
    const data = new Uint8Array(await file.arrayBuffer());
    const mime = detectMime(data),
      id = randomUUID();
    const f: FileAttachment = {
      id,
      projectId: target.projectId,
      ...(taskId ? { taskId } : { documentId }),
      name: str(
        file.name.replace(/[\x00-\x1f\\/]/g, "_"),
        "filename",
        200,
        true,
      ),
      mime,
      size: file.size,
      createdAt: new Date().toISOString(),
      uploadedBy: actor,
    };
    await saveFile(id, data);
    created = id;
    mutate((state) => {
      attachmentAccess(state, f, actor, "Edit");
      state.attachments!.push(f);
    });
    created = undefined;
    return NextResponse.json(f, { status: 201 });
  } catch (e) {
    if (created) await discardFile(created);
    if (e instanceof ApiError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json(
      { error: "Upload failed. Your file was not added. Try again." },
      { status: 500 },
    );
  }
}
