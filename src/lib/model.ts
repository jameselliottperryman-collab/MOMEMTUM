export type Status = "To do" | "In progress" | "In review" | "Done";
export type Priority = "Urgent" | "High" | "Normal" | "Low";
export type Grant = "View" | "Comment" | "Edit" | "Manage";
export type Person = {
  id: string;
  name: string;
  email: string;
  initials: string;
  color: string;
  role: "Owner" | "Member" | "Guest";
};
export type Project = {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  restricted: boolean;
  grants: Record<string, Grant>;
  archived?: boolean;
};
export type Task = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  assignees: string[];
  due: string;
  tags: string[];
  checklist: { id: string; text: string; done: boolean }[];
  version: number;
  archived: boolean;
  archivedWithParent?: string | null;
  createdAt: string;
  parentId?: string | null;
  deletedAt?: string | null;
  deletedBy?: string | null;
  deletedBatch?: string | null;
};
export type Comment = {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: string;
};
export type Activity = {
  id: string;
  taskId: string;
  actorId: string;
  text: string;
  createdAt: string;
};
export type Notice = {
  id: string;
  userId: string;
  taskId: string;
  text: string;
  read: boolean;
  createdAt: string;
};
export type Workspace = {
  id: string;
  name: string;
  initials: string;
  members: string[];
};
export type RichNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: RichNode[];
};
export type ProjectDocument = {
  id: string;
  projectId: string;
  title: string;
  body: RichNode;
  version: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
};
export type DocumentRevision = {
  id: string;
  documentId: string;
  title: string;
  body: RichNode;
  version: number;
  savedAt: string;
  savedBy: string;
};
export type FileAttachment = {
  id: string;
  projectId: string;
  taskId?: string;
  documentId?: string;
  name: string;
  mime: string;
  size: number;
  createdAt: string;
  uploadedBy: string;
};
export type DocumentLink = { documentId: string; taskId: string };
export type Reminder = {
  id: string;
  userId: string;
  taskId: string;
  dueAt: string;
  note: string;
  deliveredAt?: string;
};
export type State = {
  schemaVersion?: number;
  documents?: ProjectDocument[];
  documentRevisions?: DocumentRevision[];
  attachments?: FileAttachment[];
  documentLinks?: DocumentLink[];
  reminders?: Reminder[];
  nextDocument?: number;
  people: Person[];
  workspaces: Workspace[];
  projects: Project[];
  tasks: Task[];
  comments: Comment[];
  activity: Activity[];
  notices: Notice[];
  nextTask: number;
  importReceipts?: Record<string, { csv: string; count: number }>;
};
export const statuses: Status[] = ["To do", "In progress", "In review", "Done"];
export const priorities: Priority[] = ["Urgent", "High", "Normal", "Low"];
const rank: Record<Grant, number> = { View: 1, Comment: 2, Edit: 3, Manage: 4 };
export function grantFor(
  state: State,
  userId: string,
  project: Project,
): Grant | null {
  const user = state.people.find((p) => p.id === userId);
  const ws = state.workspaces.find((w) => w.id === project.workspaceId);
  if (!user || !ws?.members.includes(userId)) return null;
  const explicit = project.grants[userId];
  if (user.role === "Guest")
    return explicit && rank[explicit] <= rank.Comment ? explicit : null;
  if (explicit) return explicit;
  return project.restricted ? null : "Edit";
}
export function can(
  state: State,
  userId: string,
  project: Project,
  level: Grant,
) {
  const grant = grantFor(state, userId, project);
  return !!grant && rank[grant] >= rank[level];
}
export function visibleState(state: State, userId: string) {
  const projects = state.projects.filter((p) => grantFor(state, userId, p));
  const ids = new Set(projects.map((p) => p.id));
  const tasks = state.tasks.filter(
    (t) =>
      ids.has(t.projectId) &&
      (!t.deletedAt ||
        can(
          state,
          userId,
          projects.find((p) => p.id === t.projectId)!,
          "Edit",
        )),
  );
  const tids = new Set(tasks.filter((t) => !t.deletedAt).map((t) => t.id));
  const documents = (state.documents || []).filter((d) => ids.has(d.projectId));
  const dids = new Set(documents.map((d) => d.id));
  const workspaces = state.workspaces.filter((w) => w.members.includes(userId));
  const visiblePeople = new Set([
    userId,
    ...projects.flatMap((p) => Object.keys(p.grants)),
    ...tasks.flatMap((t) => t.assignees),
    ...state.comments.filter((c) => tids.has(c.taskId)).map((c) => c.authorId),
  ]);
  if (state.people.find((p) => p.id === userId)?.role !== "Guest")
    workspaces.forEach((w) => w.members.forEach((id) => visiblePeople.add(id)));
  return {
    user: state.people.find((p) => p.id === userId)!,
    people: state.people.filter((p) => visiblePeople.has(p.id)),
    workspaces,
    projects: projects.map((p) => ({
      ...p,
      access: grantFor(state, userId, p),
      assigneeIds: state.people
        .filter((u) => can(state, u.id, p, "Edit"))
        .map((u) => u.id),
      collaboratorIds: state.people
        .filter((u) => grantFor(state, u.id, p))
        .map((u) => u.id),
      grants: can(state, userId, p, "Manage") ? p.grants : {},
    })),
    tasks,
    documents,
    attachments: (state.attachments || []).filter(
      (f) =>
        ids.has(f.projectId) &&
        (f.taskId
          ? tids.has(f.taskId)
          : !!f.documentId && dids.has(f.documentId)),
    ),
    documentLinks: (state.documentLinks || []).filter(
      (l) => tids.has(l.taskId) && dids.has(l.documentId),
    ),
    reminders: (state.reminders || []).filter(
      (r) => r.userId === userId && tids.has(r.taskId),
    ),
    comments: state.comments.filter((c) => tids.has(c.taskId)),
    activity: state.activity.filter((a) => tids.has(a.taskId)),
    notices: state.notices.filter(
      (n) => n.userId === userId && tids.has(n.taskId),
    ),
  };
}
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (closed && c !== "," && c !== "\n" && c !== "\r")
      throw Error("Unexpected content after a quoted CSV cell");
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (!quoted && field.length)
        throw Error("Unexpected quote in CSV");
      else {
        closed = quoted;
        quoted = !quoted;
      }
    } else if (c === "," && !quoted) {
      row.push(field);
      field = "";
      closed = false;
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
      closed = false;
    } else field += c;
  }
  if (quoted) throw Error("Unclosed quote in CSV");
  row.push(field);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function csvCell(value: string) {
  return (
    '"' +
    (/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""') +
    '"'
  );
}
