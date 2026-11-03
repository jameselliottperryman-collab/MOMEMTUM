import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { dir } from "./store";
import type { State, FileAttachment, Grant } from "./model";
import { project, task, document, fail } from "./access";
export const MAX_FILE = 25 * 1024 * 1024;
export function attachmentAccess(
  s: State,
  f: FileAttachment,
  user: string,
  level: Grant = "View",
) {
  project(s, f.projectId, user, level);
  if (f.taskId) {
    const t = task(s, f.taskId, user, level);
    if (level !== "View" && t.archived)
      fail(403, "Restore this task before changing files.");
  } else if (f.documentId) document(s, f.documentId, user, level);
  else fail(404, "File unavailable.");
}
export function detectMime(b: Uint8Array): string {
  const v = Buffer.from(b);
  if (
    v.length >= 8 &&
    v.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (v.length >= 3 && v[0] === 255 && v[1] === 216 && v[2] === 255)
    return "image/jpeg";
  if (
    v.length >= 6 &&
    ["GIF87a", "GIF89a"].includes(v.subarray(0, 6).toString())
  )
    return "image/gif";
  if (
    v.length >= 12 &&
    v.subarray(0, 4).toString() === "RIFF" &&
    v.subarray(8, 12).toString() === "WEBP"
  )
    return "image/webp";
  if (v.length >= 5 && v.subarray(0, 5).toString() === "%PDF-")
    return "application/pdf";
  fail(415, "Choose a PNG, JPEG, WebP, GIF image or a PDF.");
}
function path(id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) fail(404, "File unavailable.");
  return join(dir, "uploads", id);
}
export async function saveFile(id: string, bytes: Uint8Array) {
  await mkdir(join(dir, "uploads"), { recursive: true });
  await writeFile(path(id), bytes, { flag: "wx", mode: 0o600 });
}
export async function loadFile(id: string) {
  return readFile(path(id));
}
export async function discardFile(id: string) {
  await unlink(path(id)).catch(() => {});
}
