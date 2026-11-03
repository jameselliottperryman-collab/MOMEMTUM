import { randomUUID } from "node:crypto";
import type { State, Task, ProjectDocument, RichNode } from "./model";
import { project, task, document, fail, str } from "./access";
import { textOf, validateDocument, subtree } from "./features";
function record(s: State, t: Task, actor: string, text: string) {
  s.activity.push({
    id: randomUUID(),
    taskId: t.id,
    actorId: actor,
    text,
    createdAt: new Date().toISOString(),
  });
}
function snapshot(s: State, d: ProjectDocument) {
  (s.documentRevisions ||= []).push({
    id: randomUUID(),
    documentId: d.id,
    title: d.title,
    body: structuredClone(d.body),
    version: d.version,
    savedAt: d.updatedAt,
    savedBy: d.updatedBy,
  });
  const old = s.documentRevisions
    .filter((r) => r.documentId === d.id)
    .slice(0, -30);
  const ids = new Set(old.map((r) => r.id));
  s.documentRevisions = s.documentRevisions.filter((r) => !ids.has(r.id));
}
function bodyFor(s: State, d: ProjectDocument, value: unknown): RichNode {
  try {
    return validateDocument(
      value,
      (id) =>
        !!s.attachments?.some(
          (f) =>
            f.id === id && f.documentId === d.id && f.mime.startsWith("image/"),
        ),
    );
  } catch (e) {
    fail(422, e instanceof Error ? e.message : "Invalid document.");
  }
}
export function featureGet(s: State, actor: string, path: string[]) {
  if (path[0] === "documents" && path[1] && path[2] === "history") {
    const d = document(s, path[1], actor);
    return {
      revisions: (s.documentRevisions || [])
        .filter((r) => r.documentId === d.id)
        .slice()
        .reverse(),
    };
  }
  return undefined;
}
export function featureMutation(
  s: State,
  actor: string,
  path: string[],
  method: string,
  b: Record<string, unknown>,
): unknown | undefined {
  const now = new Date().toISOString();
  if (path[0] === "trash" && method === "POST") {
    if (
      !Array.isArray(b.ids) ||
      !b.ids.length ||
      b.ids.length > 200 ||
      b.ids.some((id) => typeof id !== "string")
    )
      fail(422, "Select between 1 and 200 tasks.");
    if (!["delete", "restore"].includes(String(b.operation)))
      fail(422, "Choose delete or restore.");
    const selected = [...new Set(b.ids as string[])].map((id) => {
      const t = s.tasks.find((t) => t.id === id);
      if (!t) fail(404, "Task unavailable.");
      project(s, t.projectId, actor, "Edit");
      return t;
    });
    const batch = randomUUID();
    let count = 0;
    if (b.operation === "delete")
      for (const root of selected)
        for (const t of subtree(s.tasks, root.id)) {
          if (t.deletedAt) continue;
          t.deletedAt = now;
          t.deletedBy = actor;
          t.deletedBatch = batch;
          t.version++;
          record(s, t, actor, "moved this task to the trash");
          count++;
        }
    else {
      const ids = new Set(selected.map((t) => t.id));
      for (const root of selected) {
        if (
          root.parentId &&
          s.tasks.find((t) => t.id === root.parentId)?.deletedAt &&
          !ids.has(root.parentId)
        )
          fail(422, "Restore the parent task first.");
      }
      for (const root of selected
        .filter((t) => t.deletedAt)
        .sort((a, b) => Number(!!a.parentId) - Number(!!b.parentId))) {
        const group = root.deletedBatch;
        for (const t of subtree(s.tasks, root.id)) {
          if (!t.deletedAt || t.deletedBatch !== group) continue;
          t.deletedAt = null;
          t.deletedBy = null;
          t.deletedBatch = null;
          t.version++;
          record(s, t, actor, "restored this task from the trash");
          count++;
        }
      }
    }
    return { count };
  }
  if (path[0] === "documents" && path.length === 1 && method === "POST") {
    const p = project(s, str(b.projectId, "project", 100, true), actor, "Edit");
    const d: ProjectDocument = {
      id: `DOC-${(s.nextDocument = (s.nextDocument || 1) + 1) - 1}`,
      projectId: p.id,
      title: str(b.title || "Untitled document", "document title", 200, true),
      body: { type: "doc", content: [{ type: "paragraph" }] },
      version: 1,
      createdAt: now,
      updatedAt: now,
      updatedBy: actor,
    };
    s.documents!.push(d);
    return d;
  }
  if (
    path[0] === "documents" &&
    path[1] &&
    path.length === 2 &&
    method === "PATCH"
  ) {
    const d = document(s, path[1], actor, "Edit");
    if (b.version !== d.version)
      fail(
        412,
        "This document changed. Your draft is preserved. Load the latest version before merging your changes.",
      );
    const title =
      "title" in b ? str(b.title, "document title", 200, true) : d.title;
    const body = "body" in b ? bodyFor(s, d, b.body) : d.body;
    if (title === d.title && JSON.stringify(body) === JSON.stringify(d.body))
      return d;
    snapshot(s, d);
    Object.assign(d, {
      title,
      body,
      version: d.version + 1,
      updatedAt: now,
      updatedBy: actor,
    });
    return d;
  }
  if (
    path[0] === "documents" &&
    path[1] &&
    path[2] === "restore" &&
    method === "POST"
  ) {
    const d = document(s, path[1], actor, "Edit");
    if (b.version !== d.version)
      fail(412, "This document changed. Reload before restoring.");
    const r = s.documentRevisions!.find(
      (r) => r.id === b.revisionId && r.documentId === d.id,
    );
    if (!r) fail(404, "Revision unavailable.");
    snapshot(s, d);
    Object.assign(d, {
      title: r.title,
      body: structuredClone(r.body),
      version: d.version + 1,
      updatedAt: now,
      updatedBy: actor,
    });
    return d;
  }
  if (
    path[0] === "documents" &&
    path[1] &&
    path[2] === "links" &&
    (method === "POST" || method === "DELETE")
  ) {
    const d = document(s, path[1], actor, "Edit"),
      t = task(s, str(b.taskId, "task", 100, true), actor, "Edit");
    if (t.projectId !== d.projectId)
      fail(422, "Link tasks from the same project.");
    if (method === "POST") {
      if (
        !s.documentLinks!.some(
          (l) => l.documentId === d.id && l.taskId === t.id,
        )
      )
        s.documentLinks!.push({ documentId: d.id, taskId: t.id });
    } else
      s.documentLinks = s.documentLinks!.filter(
        (l) => !(l.documentId === d.id && l.taskId === t.id),
      );
    return { ok: true };
  }
  if (
    path[0] === "documents" &&
    path[1] &&
    path[2] === "tasks" &&
    method === "POST"
  ) {
    const d = document(s, path[1], actor, "Edit");
    const title = str(b.title, "task title", 200, true);
    const t: Task = {
      id: `RW-${s.nextTask++}`,
      projectId: d.projectId,
      title,
      description: `Created from ${d.title}.`,
      status: "To do",
      priority: "Normal",
      due: "",
      tags: [],
      assignees: [],
      checklist: [],
      version: 1,
      archived: false,
      createdAt: now,
    };
    s.tasks.push(t);
    s.documentLinks!.push({ taskId: t.id, documentId: d.id });
    record(s, t, actor, "created this task from a document");
    return t;
  }
  if (
    path[0] === "tasks" &&
    path[1] &&
    path[2] === "subtasks" &&
    method === "POST"
  ) {
    const parent = task(s, path[1], actor, "Edit");
    if (parent.parentId) fail(422, "Only one level of subtasks is supported.");
    if (parent.archived) fail(403, "Restore the parent task first.");
    const title = str(b.title, "subtask title", 200, true);
    const t: Task = {
      id: `RW-${s.nextTask++}`,
      projectId: parent.projectId,
      parentId: parent.id,
      title,
      description: "",
      status: "To do",
      priority: parent.priority,
      due: parent.due,
      tags: [],
      assignees: [],
      checklist: [],
      version: 1,
      archived: false,
      createdAt: now,
    };
    s.tasks.push(t);
    record(s, t, actor, "created this subtask");
    return t;
  }
  if (path[0] === "reminders" && method === "POST") {
    const t = task(s, str(b.taskId, "task", 100, true), actor);
    if (t.archived) fail(422, "Restore the task before creating a reminder.");
    const due = str(b.dueAt, "reminder date", 40, true),
      ms = Date.parse(due);
    if (
      !Number.isFinite(ms) ||
      ms <= Date.now() ||
      ms > Date.now() + 5 * 366 * 86400000
    )
      fail(422, "Choose a reminder time in the future (within five years).");
    const r = {
      id: randomUUID(),
      userId: actor,
      taskId: t.id,
      dueAt: new Date(ms).toISOString(),
      note: str(b.note || "", "reminder note", 300),
    };
    s.reminders!.push(r);
    return r;
  }
  if (path[0] === "reminders" && path[1] && method === "DELETE") {
    const r = s.reminders!.find((r) => r.id === path[1] && r.userId === actor);
    if (!r) fail(404, "Reminder unavailable.");
    s.reminders = s.reminders!.filter((x) => x.id !== r.id);
    return { ok: true };
  }
  return undefined;
}
