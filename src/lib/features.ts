import type { State, RichNode, Task } from "./model.ts";
import { grantFor } from "./model.ts";
export function normalizeState(s: State): State {
  s.schemaVersion = 2;
  s.documents ||= [];
  s.documentRevisions ||= [];
  s.attachments ||= [];
  s.documentLinks ||= [];
  s.reminders ||= [];
  s.nextDocument ||= 1;
  return s;
}
export function textOf(node: RichNode): string {
  return [
    node.text ||
      (node.type === "image"
        ? String(node.attrs?.caption || node.attrs?.alt || "")
        : ""),
    ...(node.content || []).map(textOf),
  ]
    .filter(Boolean)
    .join(" ");
}
const nodes = new Set([
  "doc",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "taskList",
  "taskItem",
  "blockquote",
  "codeBlock",
  "hardBreak",
  "horizontalRule",
  "table",
  "tableRow",
  "tableCell",
  "tableHeader",
  "image",
]);
const marks = new Set([
  "bold",
  "italic",
  "strike",
  "code",
  "link",
  "underline",
]);
export function validateDocument(
  value: unknown,
  imageAllowed: (id: string) => boolean,
): RichNode {
  if (JSON.stringify(value)?.length > 512000)
    throw Error("Document is too large (maximum 500 KB of structured text).");
  let count = 0;
  function walk(raw: unknown, depth: number): RichNode {
    if (!raw || typeof raw !== "object" || depth > 24 || ++count > 15000)
      throw Error("Invalid document structure.");
    const n = raw as RichNode;
    if (!nodes.has(n.type)) throw Error("Unsupported document block.");
    const out: RichNode = { type: n.type };
    if (n.type === "text") {
      if (typeof n.text !== "string" || n.text.length > 100000)
        throw Error("Invalid text.");
      out.text = n.text;
    }
    if (n.attrs) {
      const a = n.attrs,
        attrs: Record<string, unknown> = {};
      if (n.type === "heading") {
        if (![1, 2, 3].includes(Number(a.level)))
          throw Error("Use a heading level from 1 to 3.");
        attrs.level = Number(a.level);
      }
      if (n.type === "orderedList")
        attrs.start = Math.max(1, Math.min(10000, Number(a.start) || 1));
      if (n.type === "taskItem") attrs.checked = !!a.checked;
      if (n.type === "codeBlock") attrs.language = null;
      if (["tableCell", "tableHeader"].includes(n.type)) {
        attrs.colspan = Math.max(1, Math.min(20, Number(a.colspan) || 1));
        attrs.rowspan = Math.max(1, Math.min(100, Number(a.rowspan) || 1));
        attrs.colwidth = null;
      }
      if (n.type === "image") {
        const match =
          typeof a.src === "string" &&
          a.src.match(/^\/api\/files\/([a-f0-9-]{36})$/);
        if (!match || !imageAllowed(match[1]))
          throw Error("Images must be uploaded to this document.");
        attrs.src = a.src;
        attrs.alt = String(a.alt || "").slice(0, 300);
        attrs.title = null;
        attrs.caption = String(a.caption || "").slice(0, 500);
        attrs.width = Math.max(20, Math.min(100, Number(a.width) || 100));
      }
      out.attrs = attrs;
    }
    if (n.type === "image" && !out.attrs?.src)
      throw Error("An uploaded image is required.");
    if (n.marks) {
      if (!Array.isArray(n.marks) || n.marks.length > 8)
        throw Error("Invalid formatting.");
      out.marks = n.marks.map((m) => {
        if (!marks.has(m.type)) throw Error("Unsupported formatting.");
        if (m.type === "link") {
          const href = m.attrs?.href;
          if (
            typeof href !== "string" ||
            href.length > 2000 ||
            !/^(https?:\/\/|mailto:)/i.test(href)
          )
            throw Error("Use an HTTPS, HTTP or email link.");
          return {
            type: "link",
            attrs: {
              href,
              target: "_blank",
              rel: "noopener noreferrer nofollow",
            },
          };
        }
        return { type: m.type };
      });
    }
    if (n.content) {
      if (!Array.isArray(n.content)) throw Error("Invalid blocks.");
      out.content = n.content.map((c) => walk(c, depth + 1));
    }
    return out;
  }
  const result = walk(value, 0);
  if (result.type !== "doc") throw Error("A document root is required.");
  return result;
}
export function subtree(tasks: Task[], id: string): Task[] {
  return tasks.filter((t) => t.id === id || t.parentId === id);
}
export function deliverReminders(s: State, now = Date.now()) {
  for (const r of s.reminders || []) {
    if (r.deliveredAt || Date.parse(r.dueAt) > now) continue;
    const t = s.tasks.find((t) => t.id === r.taskId),
      p = s.projects.find((p) => p.id === t?.projectId);
    if (!t || !p || t.deletedAt || t.archived || !grantFor(s, r.userId, p))
      continue;
    const id = "reminder-" + r.id;
    if (!s.notices.some((n) => n.id === id))
      s.notices.push({
        id,
        userId: r.userId,
        taskId: t.id,
        text: `Reminder: ${t.title}${r.note ? " — " + r.note : ""}`,
        read: false,
        createdAt: new Date(now).toISOString(),
      });
    r.deliveredAt = new Date(now).toISOString();
  }
}
