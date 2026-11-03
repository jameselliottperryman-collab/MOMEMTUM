import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { readState, mutate, sessionUser, newSession } from "@/lib/store";
import {
  can,
  grantFor,
  visibleState,
  statuses,
  priorities,
  parseCSV,
  csvCell,
} from "@/lib/model";
import type { State, Task, Project, Grant } from "@/lib/model";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function fail(code: number, message: string): never {
  throw new HttpError(code, message);
}
function str(
  value: unknown,
  name: string,
  max = 3000,
  required = false,
): string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    fail(422, `Enter a valid ${name}.`);
  return value.trim();
}
function date(value: unknown) {
  const v = str(value, "due date", 10);
  if (
    v &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(v) ||
      new Date(v).toISOString().slice(0, 10) !== v)
  )
    fail(422, "Use a valid due date.");
  return v;
}
function project(
  s: State,
  id: string,
  user: string,
  level: Grant = "View",
): Project {
  const p = s.projects.find((p) => p.id === id);
  if (!p || !grantFor(s, user, p)) fail(404, "This project is unavailable.");
  if (!can(s, user, p, level))
    fail(403, `You need ${level.toLowerCase()} access for this action.`);
  return p;
}
function task(s: State, id: string, user: string, level: Grant = "View") {
  const t = s.tasks.find((t) => t.id === id);
  if (!t) fail(404, "This task is unavailable.");
  project(s, t.projectId, user, level);
  return t;
}
function activity(s: State, t: Task, user: string, text: string) {
  s.activity.push({
    id: randomUUID(),
    taskId: t.id,
    actorId: user,
    text,
    createdAt: new Date().toISOString(),
  });
}
function notify(s: State, t: Task, user: string, text: string) {
  const p = s.projects.find((p) => p.id === t.projectId)!;
  for (const id of new Set([
    ...t.assignees,
    ...s.comments.filter((c) => c.taskId === t.id).map((c) => c.authorId),
  ]))
    if (id !== user && grantFor(s, id, p))
      s.notices.push({
        id: randomUUID(),
        taskId: t.id,
        userId: id,
        text,
        read: false,
        createdAt: new Date().toISOString(),
      });
}
function taskFields(
  s: State,
  p: Project,
  b: Record<string, unknown>,
): Partial<Task> {
  const result: Partial<Task> = {};
  if ("title" in b) result.title = str(b.title, "task title", 200, true);
  if ("description" in b)
    result.description = str(b.description, "description", 10000);
  if ("status" in b) {
    if (!statuses.includes(b.status as never)) fail(422, "Invalid status.");
    result.status = b.status as Task["status"];
  }
  if ("priority" in b) {
    if (!priorities.includes(b.priority as never))
      fail(422, "Invalid priority.");
    result.priority = b.priority as Task["priority"];
  }
  if ("due" in b) result.due = date(b.due);
  if ("assignees" in b) {
    if (
      !Array.isArray(b.assignees) ||
      b.assignees.length > 30 ||
      b.assignees.some((id) => typeof id !== "string" || !can(s, id, p, "Edit"))
    )
      fail(422, "Assignees must have edit access to this project.");
    result.assignees = [...new Set(b.assignees as string[])];
  }
  if ("tags" in b) {
    if (!Array.isArray(b.tags) || b.tags.length > 12)
      fail(422, "Use at most 12 tags.");
    result.tags = [...new Set(b.tags.map((t) => str(t, "tag", 30, true)))];
  }
  if ("checklist" in b) {
    if (!Array.isArray(b.checklist) || b.checklist.length > 100)
      fail(422, "Invalid checklist.");
    result.checklist = b.checklist.map((c) => {
      if (!c || typeof c.done !== "boolean")
        fail(422, "Invalid checklist item.");
      return {
        id: str(c.id, "item ID", 100, true),
        text: str(c.text, "checklist item", 300, true),
        done: c.done,
      };
    });
  }
  if ("archived" in b) {
    if (typeof b.archived !== "boolean") fail(422, "Invalid archive state.");
    result.archived = b.archived;
  }
  return result;
}
async function handle(req: NextRequest, method: string) {
  try {
    if (process.env.RELAYWORK_DEMO !== "1")
      fail(
        503,
        "Set RELAYWORK_DEMO=1 to enable the local demonstration. Production identity is not configured.",
      );
    if (method !== "GET") {
      const origin = req.headers.get("origin");
      if (
        !origin ||
        (origin !== new URL(req.url).origin &&
          new URL(origin).host !== req.headers.get("host"))
      )
        fail(403, "Request origin is not allowed.");
    }
    const path = req.nextUrl.pathname.slice(5).split("/").filter(Boolean);
    let user = sessionUser(req.cookies.get("relaywork_session")?.value || "");
    let token: string | undefined;
    if (method === "GET" && path[0] === "state" && !user) {
      user = "alex";
      token = newSession(user);
    }
    const body =
      method === "GET"
        ? {}
        : await req.json().catch(() => fail(400, "Invalid JSON."));
    if (
      method !== "GET" &&
      (!body || typeof body !== "object" || Array.isArray(body))
    )
      fail(400, "Expected an object.");
    if (method === "POST" && path[0] === "session") {
      const id = str(body.userId, "demo account", 100, true);
      if (!readState().people.some((p) => p.id === id))
        fail(404, "Account unavailable.");
      const res = NextResponse.json({ ok: true });
      res.cookies.set("relaywork_session", newSession(id), {
        httpOnly: true,
        sameSite: "lax",
        secure: req.nextUrl.protocol === "https:",
        path: "/",
        maxAge: 86400,
      });
      return res;
    }
    if (!user) fail(401, "Your session expired. Reload to enter the demo.");
    const actor = user;
    if (method === "GET" && path[0] === "state") {
      const res = NextResponse.json(
        { ...visibleState(readState(), actor), demo: true },
        { headers: { "Cache-Control": "private, no-store" } },
      );
      if (token)
        res.cookies.set("relaywork_session", token, {
          httpOnly: true,
          sameSite: "lax",
          secure: req.nextUrl.protocol === "https:",
          path: "/",
          maxAge: 86400,
        });
      return res;
    }
    if (method === "GET" && path[0] === "export" && path[1]) {
      const s = readState();
      project(s, path[1], actor, "Manage");
      const rows = [
        ["Title", "Description", "Status", "Priority", "Due date", "Tags"],
        ...s.tasks
          .filter((t) => t.projectId === path[1] && !t.archived)
          .map((t) => [
            t.title,
            t.description,
            t.status,
            t.priority,
            t.due,
            t.tags.join(";"),
          ]),
      ];
      return new NextResponse(
        rows.map((row) => row.map(csvCell).join(",")).join("\r\n"),
        {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="relaywork-tasks.csv"',
          },
        },
      );
    }
    const result = mutate((s) => {
      const person = s.people.find((p) => p.id === actor)!;
      if (method === "POST" && path[0] === "workspaces") {
        if (person.role === "Guest")
          fail(403, "Guests cannot create workspaces.");
        const name = str(body.name, "workspace name", 80, true);
        const ws = {
          id: randomUUID(),
          name,
          initials: name
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase(),
          members: [actor],
        };
        s.workspaces.push(ws);
        const p: Project = {
          id: randomUUID(),
          workspaceId: ws.id,
          name: "Getting started",
          description: "Your next great project starts here.",
          color: "#8772ce",
          icon: "spark",
          restricted: false,
          grants: { [actor]: "Manage" },
        };
        s.projects.push(p);
        return { workspaceId: ws.id, projectId: p.id };
      }
      if (method === "POST" && path[0] === "projects" && path.length === 1) {
        const ws = s.workspaces.find(
          (w) => w.id === body.workspaceId && w.members.includes(actor),
        );
        if (!ws) fail(404, "Workspace unavailable.");
        if (person.role !== "Owner")
          fail(
            403,
            "Only the workspace owner can create projects in this demo.",
          );
        const p: Project = {
          id: randomUUID(),
          workspaceId: ws.id,
          name: str(body.name, "project name", 80, true),
          description: str(body.description ?? "", "description"),
          color: "#8772ce",
          icon: "folder",
          restricted: !!body.restricted,
          grants: { [actor]: "Manage" },
        };
        s.projects.push(p);
        return p;
      }
      if (
        path[0] === "projects" &&
        path[1] &&
        path[2] === "grants" &&
        method === "POST"
      ) {
        const p = project(s, path[1], actor, "Manage");
        const member = s.people.find((m) => m.id === body.userId);
        if (
          !member ||
          !s.workspaces
            .find((w) => w.id === p.workspaceId)
            ?.members.includes(member.id)
        )
          fail(422, "Choose an existing workspace member.");
        if (member.id === actor)
          fail(422, "You cannot remove your own manager access.");
        if (body.grant === null) delete p.grants[member.id];
        else {
          if (!["View", "Comment", "Edit", "Manage"].includes(body.grant))
            fail(422, "Invalid access level.");
          if (
            member.role === "Guest" &&
            !["View", "Comment"].includes(body.grant)
          )
            fail(422, "Guests may only view or comment.");
          p.grants[member.id] = body.grant;
        }
        return { ok: true };
      }
      if (path[0] === "tasks" && path.length === 1 && method === "POST") {
        const p = project(s, body.projectId, actor, "Edit");
        if (p.archived) fail(403, "Archived project is read-only.");
        const fields = taskFields(s, p, body);
        if (!fields.title) fail(422, "A task title is required.");
        const t: Task = {
          id: `RW-${s.nextTask++}`,
          projectId: p.id,
          title: fields.title,
          description: "",
          status: "To do",
          priority: "Normal",
          assignees: [],
          due: "",
          tags: [],
          checklist: [],
          version: 1,
          archived: false,
          createdAt: new Date().toISOString(),
          ...fields,
        };
        s.tasks.push(t);
        activity(s, t, actor, "created this task");
        notify(s, t, actor, `${person.name} assigned you to ${t.title}`);
        return t;
      }
      if (path[0] === "tasks" && path[1] && method === "PATCH") {
        const t = task(s, path[1], actor, "Edit");
        const p = project(s, t.projectId, actor, "Edit");
        if (p.archived) fail(403, "Archived project is read-only.");
        if (body.version !== t.version)
          fail(
            412,
            "This task changed. Your input has been kept; reload the latest task before saving again.",
          );
        if ("archived" in body) project(s, t.projectId, actor, "Manage");
        const updates = taskFields(s, p, body);
        const old = t.status;
        Object.assign(t, updates, { version: t.version + 1 });
        activity(
          s,
          t,
          actor,
          updates.status && old !== updates.status
            ? `moved this task from ${old} to ${t.status}`
            : updates.archived !== undefined
              ? updates.archived
                ? "archived this task"
                : "restored this task"
              : "updated this task",
        );
        notify(s, t, actor, `${person.name} updated ${t.title}`);
        return t;
      }
      if (
        path[0] === "tasks" &&
        path[1] &&
        path[2] === "comments" &&
        method === "POST"
      ) {
        const t = task(s, path[1], actor, "Comment");
        const c = {
          id: randomUUID(),
          taskId: t.id,
          authorId: actor,
          body: str(body.body, "comment", 5000, true),
          createdAt: new Date().toISOString(),
        };
        if (t.archived) fail(403, "Restore this task before commenting.");
        s.comments.push(c);
        notify(s, t, actor, `${person.name} commented on ${t.title}`);
        return c;
      }
      if (path[0] === "notices" && method === "PATCH") {
        s.notices
          .filter((n) => n.userId === actor && (!body.id || n.id === body.id))
          .forEach((n) => {
            const t = s.tasks.find((t) => t.id === n.taskId);
            if (
              t &&
              grantFor(
                s,
                actor,
                s.projects.find((p) => p.id === t.projectId)!,
              )
            )
              n.read = typeof body.read === "boolean" ? body.read : true;
          });
        return { ok: true };
      }
      if (path[0] === "import" && method === "POST") {
        const p = project(s, body.projectId, actor, "Edit");
        const csv = str(body.csv, "CSV", 500000, true);
        const op = body.commit
          ? str(body.operationId, "import operation ID", 100, true)
          : "";
        const receiptKey = actor + ":" + p.id + ":" + op;
        const previous = s.importReceipts?.[receiptKey];
        if (body.commit && previous) {
          if (previous.csv !== csv)
            fail(
              409,
              "This import operation was already used for a different file.",
            );
          return { count: previous.count };
        }
        let rows: string[][];
        try {
          rows = parseCSV(csv);
        } catch {
          fail(422, "Malformed CSV: check quotes and delimiters.");
        }
        const headers = rows.shift()?.map((h) => h.trim().toLowerCase()) || [];
        if (new Set(headers).size !== headers.length)
          fail(422, "CSV headers must be unique.");
        if (!headers.includes("title"))
          fail(422, "CSV must include a Title column.");
        if (rows.length > 500 || !rows.length)
          fail(422, "Import between 1 and 500 tasks.");
        const parsed = rows.map((r, i) => {
          if (r.length !== headers.length)
            fail(422, `Row ${i + 2} has an incorrect number of columns.`);
          const value = (h: string) => r[headers.indexOf(h)] || "";
          return taskFields(s, p, {
            title: value("title"),
            description: value("description"),
            status: value("status") || "To do",
            priority: value("priority") || "Normal",
            due: value("due date"),
            tags: value("tags").split(";").filter(Boolean),
          });
        });
        if (!body.commit) return { preview: parsed };
        for (const fields of parsed) {
          const t: Task = {
            id: `RW-${s.nextTask++}`,
            projectId: p.id,
            title: fields.title!,
            description: "",
            status: "To do",
            priority: "Normal",
            due: "",
            assignees: [],
            tags: [],
            checklist: [],
            version: 1,
            archived: false,
            createdAt: new Date().toISOString(),
            ...fields,
          };
          s.tasks.push(t);
          activity(s, t, actor, "imported this task");
        }
        (s.importReceipts ||= {})[receiptKey] = { csv, count: parsed.length };
        return { count: parsed.length };
      }
      fail(404, "Route unavailable.");
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof HttpError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof SyntaxError || e instanceof RangeError)
      return NextResponse.json({ error: "Invalid input." }, { status: 422 });
    console.error(
      "Relaywork request failed:",
      e instanceof Error ? e.name : "unknown",
    );
    return NextResponse.json(
      { error: "The request could not be completed. Please try again." },
      { status: 500 },
    );
  }
}
export const GET = (req: NextRequest) => handle(req, "GET");
export const POST = (req: NextRequest) => handle(req, "POST");
export const PATCH = (req: NextRequest) => handle(req, "PATCH");
