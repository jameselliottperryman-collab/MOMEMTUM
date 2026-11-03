"use client";
import {
  useState,
  useEffect,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowUpRight,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  ArrowLeft,
  Bell,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleCheck,
  CircleHelp,
  Asterisk,
  Clock3,
  Command,
  Download,
  Ellipsis,
  Flag,
  Folder,
  Globe2,
  Inbox,
  LayoutGrid,
  List,
  LoaderCircle,
  LockKeyhole,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Users,
  X,
  CalendarDays,
  Link2,
  Archive,
  Trash2,
  FileText,
  Send,
  CircleDashed,
  Activity,
  PanelLeftClose,
} from "lucide-react";
import type {
  Person,
  Task,
  Project,
  State,
  Grant,
  Comment as TaskComment,
  Activity as TaskActivity,
  Notice,
  Workspace,
  ProjectDocument,
  FileAttachment,
  DocumentLink,
  Reminder,
} from "@/lib/model";
import {
  DocumentsView,
  TrashView,
  TaskExtras,
  UniversalSearch,
} from "@/components/work-features";
import { statuses, priorities } from "@/lib/model";
type ProjectView = Project & {
  access: Grant;
  assigneeIds: string[];
  collaboratorIds: string[];
};
type Data = {
  user: Person;
  people: Person[];
  workspaces: Workspace[];
  projects: ProjectView[];
  tasks: Task[];
  comments: TaskComment[];
  activity: TaskActivity[];
  notices: Notice[];
  demo: boolean;
  documents: ProjectDocument[];
  attachments: FileAttachment[];
  documentLinks: DocumentLink[];
  reminders: Reminder[];
};
type Modal =
  | "task"
  | "project"
  | "workspace"
  | "share"
  | "search"
  | "import"
  | "help"
  | null;
const statusClass = (s: string) => s.toLowerCase().replaceAll(" ", "-");
const dateLabel = (date: string) =>
  date
    ? new Date(date + "T12:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "No date";
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "UTC" });
const iconSize = 16;
function Brand({ small = false }: { small?: boolean }) {
  return (
    <div className={"brand " + (small ? "brand-small" : "")}>
      <span className="brand-mark">
        <span />
        <span />
        <span />
        <span />
      </span>
      {!small && (
        <span>
          relaywork<span className="brand-period">.</span>
        </span>
      )}
    </div>
  );
}
function Avatar({ person, size = 26 }: { person?: Person; size?: number }) {
  return (
    <span
      className="avatar"
      title={person?.name || "Unassigned"}
      style={{
        background: person?.color || "#eee",
        width: size,
        height: size,
        fontSize: size < 28 ? 9 : 11,
      }}
    >
      {person?.initials || "–"}
    </span>
  );
}
function PriorityIcon({ priority }: { priority: string }) {
  return (
    <span
      className={"priority-icon " + priority.toLowerCase()}
      title={priority}
    >
      {priority === "Urgent" ? (
        <Flag size={13} fill="currentColor" />
      ) : priority === "High" ? (
        <ArrowUp size={14} />
      ) : priority === "Low" ? (
        <ArrowDown size={14} />
      ) : (
        <span className="priority-lines">＝</span>
      )}
    </span>
  );
}
function StatusIcon({ status }: { status: string }) {
  return status === "Done" ? (
    <CircleCheck size={15} />
  ) : status === "In progress" ? (
    <LoaderCircle size={15} />
  ) : status === "In review" ? (
    <CircleDashed size={15} />
  ) : (
    <Circle size={15} />
  );
}
function ModalFrame({
  title,
  subtitle,
  children,
  close,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const nodes = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button,input,textarea,select,a[href],[tabindex="0"]',
        ) || [],
      ).filter((el) => !el.hasAttribute("disabled"));
    nodes()
      .find((el) => el.tagName === "INPUT")
      ?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const a = nodes();
        if (!a.length) return;
        const first = a[0],
          last = a.at(-1)!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", listener);
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={"modal " + (wide ? "wide" : "")}
      >
        <div className="modal-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={close}
          >
            <X size={19} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export default function Home() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => setDesktop(!!window.relayworkDesktop), []);
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState("studio"),
    [projectId, setProjectId] = useState("brand"),
    [screen, setScreen] = useState<"project" | "mywork" | "inbox">("project"),
    [layout, setLayout] = useState<
      "Board" | "List" | "Overview" | "Documents" | "Trash"
    >("Board");
  const [modal, setModal] = useState<Modal>(null),
    [selected, setSelected] = useState<string | null>(null),
    [sidebar, setSidebar] = useState(false),
    [accountMenu, setAccountMenu] = useState(false),
    [workspaceMenu, setWorkspaceMenu] = useState(false);
  const [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [priority, setPriority] = useState("All"),
    [assignee, setAssignee] = useState("All"),
    [statusFilter, setStatusFilter] = useState("All"),
    [sort, setSort] = useState("Manual"),
    [dueFilter, setDueFilter] = useState("All"),
    [filters, setFilters] = useState(false),
    [showArchive, setShowArchive] = useState(false),
    [unread, setUnread] = useState(false);
  const [newStatus, setNewStatus] = useState("To do"),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState("");
  const [csv, setCsv] = useState(""),
    [preview, setPreview] = useState<Partial<Task>[] | null>(null),
    [detailTab, setDetailTab] = useState("Comments");
  const [activeDocument, setActiveDocument] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const refreshSequence = useRef(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const importKey = useRef("");
  const requestedDocument = useRef<{ id: string; projectId: string } | null>(
    null,
  );
  async function refresh() {
    const sequence = ++refreshSequence.current;
    const r = await fetch("/api/state", { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    if (sequence === refreshSequence.current) setData(d);
    return d as Data;
  }
  useEffect(() => {
    refresh()
      .then((d) => {
        const id = new URLSearchParams(location.search).get("project");
        if (id) {
          const p = d.projects.find((p) => p.id === id);
          if (p) {
            setProjectId(p.id);
            setWorkspace(p.workspaceId);
          } else setToast("This project is unavailable.");
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setModal("search");
      }
      if (e.key === "Escape") {
        setSelected(null);
        setSidebar(false);
        setAccountMenu(false);
        setWorkspaceMenu(false);
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    try {
      const v = JSON.parse(
        localStorage.getItem("relaywork-view-" + projectId) || "null",
      );
      setPriority(v?.priority || "All");
      setAssignee(v?.assignee || "All");
      setStatusFilter(v?.status || "All");
      setSort(v?.sort || "Manual");
      setDueFilter(v?.due || "All");
      setLayout(v?.layout || "Board");
    } catch {}
    setQuery("");
    setShowArchive(false);
    if (requestedDocument.current?.projectId === projectId) {
      setLayout("Documents");
      setActiveDocument(requestedDocument.current.id);
      requestedDocument.current = null;
    }
  }, [projectId]);
  function saveView() {
    localStorage.setItem(
      "relaywork-view-" + projectId,
      JSON.stringify({
        priority,
        assignee,
        status: statusFilter,
        due: dueFilter,
        sort,
        layout,
      }),
    );
    setToast("Your personal view has been saved.");
  }
  async function api(path: string, method: string, body: unknown) {
    const r = await fetch("/api/" + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error || "Something went wrong.");
    return d;
  }
  async function action(
    path: string,
    method: string,
    body: unknown,
    message?: string,
  ) {
    setBusy(true);
    setFormError("");
    try {
      const result = await api(path, method, body);
      await refresh();
      if (message) setToast(message);
      return result;
    } catch (e) {
      const m = e instanceof Error ? e.message : "Something went wrong.";
      setFormError(m);
      setToast(m);
      return null;
    } finally {
      setBusy(false);
    }
  }
  function openModal(m: Modal) {
    setFormError("");
    setModal(m);
    setAccountMenu(false);
    setWorkspaceMenu(false);
    if (m === "import") {
      setCsv("");
      setPreview(null);
      importKey.current = crypto.randomUUID();
    }
  }
  function openDocument(id: string) {
    const d = data?.documents.find((d) => d.id === id);
    if (!d) return;
    if (d.projectId !== projectId)
      requestedDocument.current = { id: d.id, projectId: d.projectId };
    setSelected(null);
    setModal(null);
    setProjectId(d.projectId);
    setScreen("project");
    setLayout("Documents");
    setActiveDocument(id);
  }
  function openProject(id: string) {
    setProjectId(id);
    setScreen("project");
    setSidebar(false);
  }
  function openTask(id: string) {
    setSelected(id);
    setDetailTab("Comments");
    setFormError("");
  }
  function addTask(status = "To do") {
    setNewStatus(status);
    openModal("task");
  }
  const project = data?.projects.find((p) => p.id === projectId);
  const ws = data?.workspaces.find((w) => w.id === workspace);
  const person = (id: string) => data?.people.find((p) => p.id === id);
  const canEdit = project && ["Edit", "Manage"].includes(project.access);
  const canManage = project?.access === "Manage";
  const baseTasks =
    data?.tasks.filter((t) => {
      const p = data.projects.find((p) => p.id === t.projectId);
      return (
        !t.deletedAt &&
        p?.workspaceId === workspace &&
        (screen === "mywork"
          ? t.assignees.includes(data.user.id)
          : t.projectId === projectId)
      );
    }) || [];
  const tasks = baseTasks
    .filter(
      (t) =>
        t.archived === showArchive &&
        (priority === "All" || t.priority === priority) &&
        (assignee === "All" ||
          (assignee === "Unassigned"
            ? !t.assignees.length
            : t.assignees.includes(assignee))) &&
        (statusFilter === "All" || t.status === statusFilter) &&
        (dueFilter === "All" ||
          (dueFilter === "No date" && !t.due) ||
          (dueFilter === "Overdue" &&
            !!t.due &&
            t.due < today() &&
            t.status !== "Done") ||
          (dueFilter === "Upcoming" &&
            !!t.due &&
            t.due >= today() &&
            t.status !== "Done")) &&
        (!query ||
          `${t.title} ${t.id} ${t.description} ${t.tags.join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase())),
    )
    .sort((a, b) =>
      sort === "Due date"
        ? (a.due || "9999").localeCompare(b.due || "9999")
        : sort === "Priority"
          ? priorities.indexOf(a.priority) - priorities.indexOf(b.priority)
          : sort === "Name"
            ? a.title.localeCompare(b.title)
            : 0,
    );
  const activeBase = baseTasks.filter((t) => !t.archived),
    done = activeBase.filter((t) => t.status === "Done").length;
  const selectedTask = data?.tasks.find(
    (t) => t.id === selected && !t.deletedAt,
  );
  const selectedProject = data?.projects.find(
    (p) => p.id === selectedTask?.projectId,
  );
  const visibleNotices =
    data?.notices.filter((n) =>
      data.tasks.some(
        (t) =>
          t.id === n.taskId &&
          data.projects.some(
            (p) => p.id === t.projectId && p.workspaceId === workspace,
          ),
      ),
    ) || [];
  const unreadCount = visibleNotices.filter((n) => !n.read).length;
  const numFilters = [priority, assignee, statusFilter, dueFilter].filter(
    (v) => v !== "All",
  ).length;
  async function updateTask(t: Task, fields: Partial<Task>) {
    return action("tasks/" + t.id, "PATCH", { ...fields, version: t.version });
  }
  async function switchPerson(id: string) {
    const result = await action("session", "POST", { userId: id });
    if (result) {
      const d = await refresh();
      setWorkspace(d.workspaces[0]?.id || "");
      setProjectId(d.projects[0]?.id || "");
      setScreen("project");
      setSelected(null);
      setModal(null);
      setAccountMenu(false);
      setToast(
        "Switched demo account. Project access is checked on the server.",
      );
    }
  }
  useEffect(
    () =>
      window.relayworkDesktop?.onAction((command) => {
        if (command === "search") openModal("search");
        if (command === "help") openModal("help");
        if (command === "new-task") {
          if (canEdit) addTask();
          else
            setToast(
              "Select a project where you have edit access to create a task.",
            );
        }
        if (command === "my-work" || command === "inbox") {
          setSelected(null);
          setModal(null);
          setScreen(command === "inbox" ? "inbox" : "mywork");
        }
        if (command === "board" || command === "list") {
          setScreen("project");
          setLayout(command === "board" ? "Board" : "List");
        }
      }),
    [data, projectId, screen],
  );
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible")
        void refresh().catch(() => {});
    }, 15000);
    const focus = () => void refresh().catch(() => {});
    window.addEventListener("focus", focus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, []);
  useEffect(() => setSelectedTaskIds([]), [projectId]);
  async function deleteTasks(ids: string[]) {
    const r = await action(
      "trash",
      "POST",
      { ids, operation: "delete" },
      "Tasks moved to trash. You can restore them from the Trash tab.",
    );
    if (r) {
      setSelectedTaskIds([]);
      setSelected(null);
    }
  }
  useEffect(() => {
    if (layout === "Trash" && data && !canEdit) setLayout("Board");
  }, [layout, canEdit, data?.user.id]);
  if (loading)
    return (
      <div className="loading-screen">
        <Brand />
        <LoaderCircle className="spin" size={24} />
        <p>Getting your workspace ready…</p>
      </div>
    );
  if (error || !data)
    return (
      <div className="loading-screen">
        <Brand />
        <h2>We couldn’t open your workspace</h2>
        <p>{error}</p>
        <button className="button primary" onClick={() => location.reload()}>
          Try again
        </button>
      </div>
    );
  const taskCard = (t: Task) => (
    <article
      key={t.id}
      className={"task-card " + (t.status === "Done" ? "completed" : "")}
      draggable={!!canEdit && !showArchive}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", t.id);
        e.dataTransfer.effectAllowed = "move";
      }}
    >
      <div className="card-top">
        <span className="task-id">{t.id}</span>
        <button
          className="icon-button tiny"
          aria-label={"Open " + t.title}
          onClick={() => openTask(t.id)}
        >
          <Ellipsis size={17} />
        </button>
      </div>
      <button className="card-title" onClick={() => openTask(t.id)}>
        {t.title}
      </button>
      {t.parentId && (
        <button
          className="subtask-parent-link"
          onClick={() => openTask(t.parentId!)}
        >
          Subtask · {t.parentId}
        </button>
      )}
      <p className="card-description">{t.description}</p>
      <div className="tag-row">
        {t.tags.map((tag) => (
          <span
            key={tag}
            className={
              "tag " +
              (tag === "Design"
                ? "tag-purple"
                : tag === "Content"
                  ? "tag-peach"
                  : tag === "Website"
                    ? "tag-blue"
                    : tag === "Research"
                      ? "tag-green"
                      : "tag-neutral")
            }
          >
            {tag}
          </span>
        ))}
      </div>
      {!!t.checklist.length && (
        <div className="check-progress">
          <span>
            <CheckCheck size={12} />
            {t.checklist.filter((i) => i.done).length}/{t.checklist.length}
          </span>
          <span className="mini-progress">
            <i
              style={{
                width:
                  (100 * t.checklist.filter((i) => i.done).length) /
                    t.checklist.length +
                  "%",
              }}
            />
          </span>
        </div>
      )}
      <div className="card-footer">
        <div className="avatar-stack">
          {t.assignees.map((id) => (
            <Avatar key={id} person={person(id)} />
          ))}
          {!t.assignees.length && (
            <span className="unassigned-avatar">
              <Users size={12} />
            </span>
          )}
        </div>
        <span
          className={
            "card-date " +
            (t.due && t.due < today() && t.status !== "Done" ? "overdue" : "")
          }
        >
          <CalendarDays size={12} />
          {dateLabel(t.due)}
        </span>
        <span className="card-comment" title="Comments">
          <MessageSquare size={12} />
          {data.comments.filter((c) => c.taskId === t.id).length || ""}
        </span>
        <PriorityIcon priority={t.priority} />
      </div>
    </article>
  );
  return (
    <div className="app-shell">
      {sidebar && (
        <div className="sidebar-scrim" onClick={() => setSidebar(false)} />
      )}
      <aside className={"sidebar " + (sidebar ? "mobile-open" : "")}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="icon-button sidebar-collapse"
            aria-label="Close navigation"
            onClick={() => setSidebar(false)}
          >
            <PanelLeftClose size={16} />
          </button>
        </div>
        <div className="workspace-wrap">
          <button
            className="workspace-switch"
            onClick={() => setWorkspaceMenu(!workspaceMenu)}
            aria-expanded={workspaceMenu}
          >
            <span className="workspace-avatar">{ws?.initials || "RW"}</span>
            <span>
              <strong>{ws?.name || "Your workspace"}</strong>
              <small>Team workspace</small>
            </span>
            <ChevronDown size={14} />
          </button>
          {workspaceMenu && (
            <div className="popover workspace-popover">
              <span className="menu-label">WORKSPACES</span>
              {data.workspaces.map((w) => (
                <button
                  key={w.id}
                  onClick={() => {
                    setWorkspace(w.id);
                    setProjectId(
                      data.projects.find((p) => p.workspaceId === w.id)?.id ||
                        "",
                    );
                    setScreen("project");
                    setSelected(null);
                    setWorkspaceMenu(false);
                  }}
                >
                  {w.name}
                  {w.id === workspace && <Check size={14} />}
                </button>
              ))}
              {data.user.role !== "Guest" && (
                <button onClick={() => openModal("workspace")}>
                  <Plus size={14} />
                  Create workspace
                </button>
              )}
            </div>
          )}
        </div>
        <button className="sidebar-search" onClick={() => openModal("search")}>
          <Search size={16} />
          <span>Search anything</span>
          <kbd>⌘ K</kbd>
        </button>
        <nav className="main-nav" aria-label="Main navigation">
          <button
            className={screen === "mywork" ? "active" : ""}
            onClick={() => {
              setScreen("mywork");
              setSidebar(false);
              setShowArchive(false);
            }}
          >
            <CircleCheck size={18} />
            My work
          </button>
          <button
            className={screen === "inbox" ? "active" : ""}
            onClick={() => {
              setScreen("inbox");
              setSidebar(false);
            }}
          >
            <Inbox size={18} />
            Inbox
            {unreadCount > 0 && (
              <span className="nav-badge">{unreadCount}</span>
            )}
          </button>
        </nav>
        <div className="nav-section-heading">
          <span>WORKSPACE</span>
          {data.user.role === "Owner" && (
            <button
              className="icon-button tiny"
              aria-label="New project"
              onClick={() => openModal("project")}
            >
              <Plus size={16} />
            </button>
          )}
        </div>
        <div className="space-label">
          <ChevronDown size={13} />
          <span className="space-icon">
            <LayoutGrid size={13} />
          </span>
          Creative studio
        </div>
        <nav className="project-nav" aria-label="Projects">
          {data.projects
            .filter((p) => p.workspaceId === workspace && !p.archived)
            .map((p) => (
              <button
                key={p.id}
                className={
                  screen === "project" && p.id === projectId ? "active" : ""
                }
                onClick={() => openProject(p.id)}
              >
                <span className="project-dot" style={{ background: p.color }} />
                {p.name}
                {p.restricted && <LockKeyhole size={11} />}
              </button>
            ))}
          {data.user.role === "Owner" && (
            <button
              className="add-project"
              onClick={() => openModal("project")}
            >
              <Plus size={14} />
              Add project
            </button>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="team-note">
            <span className="note-doodle">
              <Asterisk size={48} />
            </span>
            <h4>A little more in sync.</h4>
            <p>
              Good work happens
              <br />
              when we work together.
            </p>
            <button onClick={() => openModal(project ? "share" : "help")}>
              Meet your team <ArrowUpRight size={13} />
            </button>
          </div>
          <button className="help-button" onClick={() => openModal("help")}>
            <CircleHelp size={17} />
            Help & getting started
            <ArrowUpRight size={13} />
          </button>
          <div className="account-wrap">
            <button
              className="account-button"
              onClick={() => setAccountMenu(!accountMenu)}
              aria-expanded={accountMenu}
            >
              <Avatar person={data.user} size={32} />
              <span>
                <strong>{data.user.name}</strong>
                <small>{data.user.role} · Demo account</small>
              </span>
              <ChevronDown size={14} />
            </button>
            {accountMenu && (
              <div className="popover account-popover">
                <span className="menu-label">SWITCH DEMO ACCOUNT</span>
                {[
                  {
                    id: "alex",
                    name: "Alex Morgan",
                    initials: "AM",
                    color: "#e5d9fc",
                    role: "Owner",
                    email: "alex@example.test",
                  },
                  {
                    id: "nina",
                    name: "Nina Patel",
                    initials: "NP",
                    color: "#f7d7ca",
                    role: "Member",
                    email: "nina@example.test",
                  },
                  {
                    id: "leo",
                    name: "Leo Chen",
                    initials: "LC",
                    color: "#d4e8dc",
                    role: "Member",
                    email: "leo@example.test",
                  },
                  {
                    id: "jordan",
                    name: "Jordan Lee",
                    initials: "JL",
                    color: "#d7e5f9",
                    role: "Guest",
                    email: "jordan@example.test",
                  },
                ].map((p) => (
                  <button
                    key={p.id}
                    disabled={busy}
                    onClick={() => switchPerson(p.id)}
                  >
                    <Avatar person={p as Person} />
                    <span>
                      {p.name}
                      <small>{p.role}</small>
                    </span>
                    {p.id === data.user.id && <Check size={14} />}
                  </button>
                ))}
                <p>Sample accounts only. No real email is sent.</p>
              </div>
            )}
          </div>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setSidebar(true)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumbs">
            <span className="breadcrumb-icon">
              <LayoutGrid size={14} />
            </span>
            <span>Creative studio</span>
            <ChevronRight size={13} />
            <strong>
              {screen === "project"
                ? project?.name || "Projects"
                : screen === "mywork"
                  ? "My work"
                  : "Inbox"}
            </strong>
            {project?.restricted && screen === "project" && (
              <LockKeyhole size={12} />
            )}
          </div>
          <div className="topbar-right">
            <span className="demo-label">
              <span />
              {desktop ? "Desktop demo" : "Demo workspace"}
            </span>
            <button
              className="icon-button notification-button"
              aria-label="Open inbox"
              onClick={() => setScreen("inbox")}
            >
              <Bell size={18} />
              {unreadCount > 0 && <i />}
            </button>
            <div className="topbar-divider" />
            <Avatar person={data.user} size={29} />
          </div>
        </header>
        {screen === "inbox" ? (
          <section className="inbox-page">
            <div className="eyebrow">YOUR WORK, IN THE LOOP</div>
            <div className="page-title-row">
              <div>
                <h1>
                  Inbox<span className="heading-dot">.</span>
                </h1>
                <p>A little less noise. Just the updates that matter.</p>
              </div>
              <button
                className="button"
                onClick={() =>
                  action("notices", "PATCH", {}, "All updates marked as read.")
                }
              >
                <CheckCheck size={15} />
                Mark all as read
              </button>
            </div>
            <div className="inbox-tabs">
              <button
                className={!unread ? "selected" : ""}
                onClick={() => setUnread(false)}
              >
                All updates <span>{visibleNotices.length}</span>
              </button>
              <button
                className={unread ? "selected" : ""}
                onClick={() => setUnread(true)}
              >
                Unread <span>{unreadCount}</span>
              </button>
            </div>
            <div className="notification-list">
              {visibleNotices
                .filter((n) => !unread || !n.read)
                .slice()
                .reverse()
                .map((n) => (
                  <div
                    key={n.id}
                    className={"notification-row " + (!n.read ? "unread" : "")}
                  >
                    <span className="notification-symbol">
                      <MessageSquare size={19} />
                    </span>
                    <button
                      onClick={() => {
                        openTask(n.taskId);
                        action("notices", "PATCH", { id: n.id, read: true });
                      }}
                    >
                      <strong>{n.text}</strong>
                      <span>
                        {n.taskId} ·{" "}
                        {new Date(n.createdAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </button>
                    <button
                      className="icon-button"
                      aria-label={n.read ? "Mark unread" : "Mark read"}
                      onClick={() =>
                        action("notices", "PATCH", { id: n.id, read: !n.read })
                      }
                    >
                      {n.read ? (
                        <CheckCheck size={17} />
                      ) : (
                        <Circle size={12} fill="#8a73cf" color="#8a73cf" />
                      )}
                    </button>
                  </div>
                ))}
              {!visibleNotices.filter((n) => !unread || !n.read).length && (
                <div className="empty-state">
                  <span className="empty-icon">
                    <Inbox size={28} />
                  </span>
                  <h3>You’re all caught up</h3>
                  <p>New assignments and conversations will appear here.</p>
                </div>
              )}
            </div>
          </section>
        ) : (
          <>
            <section className="project-heading">
              <div className="project-title-line">
                <div className="project-title-group">
                  <span
                    className={
                      "project-emblem " +
                      (screen === "mywork" ? "mywork-emblem" : "")
                    }
                  >
                    {screen === "mywork" ? (
                      <CircleCheck size={25} />
                    ) : (
                      <Sparkles size={25} />
                    )}
                  </span>
                  <div>
                    <div className="project-title">
                      <h1>
                        {screen === "mywork"
                          ? "My work"
                          : project?.name || "Your next chapter"}
                      </h1>
                      {screen === "project" && (
                        <span className="project-type">Project</span>
                      )}
                    </div>
                    <p>
                      {screen === "mywork"
                        ? "Your priorities, your progress. One clear place to start."
                        : project?.description ||
                          "Create a project and give your ideas a place to grow."}
                    </p>
                  </div>
                </div>
                <div className="project-actions">
                  <div className="avatar-stack header-avatars">
                    {(screen === "mywork"
                      ? [data.user]
                      : data.people.filter((p) =>
                          project?.collaboratorIds.includes(p.id),
                        )
                    )
                      .slice(0, 4)
                      .map((p) => (
                        <Avatar key={p.id} person={p} size={29} />
                      ))}
                  </div>
                  {screen === "project" && project && (
                    <button
                      className="button share-button"
                      onClick={() => openModal("share")}
                    >
                      <Users size={14} />
                      Share
                    </button>
                  )}
                </div>
              </div>
              <div className="view-tabs">
                <div className="view-tab-group">
                  {(
                    [
                      "Overview",
                      "List",
                      "Board",
                      ...(screen === "project" ? ["Documents"] : []),
                      ...(screen === "project" && canEdit ? ["Trash"] : []),
                    ] as (
                      "Overview" | "List" | "Board" | "Documents" | "Trash"
                    )[]
                  ).map((v) => (
                    <button
                      key={v}
                      className={layout === v ? "selected" : ""}
                      onClick={() => setLayout(v)}
                    >
                      {v === "Documents" ? (
                        <FileText size={15} />
                      ) : v === "Trash" ? (
                        <Trash2 size={15} />
                      ) : v === "Overview" ? (
                        <LayoutGrid size={15} />
                      ) : v === "List" ? (
                        <List size={16} />
                      ) : (
                        <span className="board-icon">
                          <i />
                          <i />
                          <i />
                        </span>
                      )}
                      {v}
                    </button>
                  ))}
                </div>
                <span className="project-updated">
                  <span />
                  All changes saved
                </span>
              </div>
            </section>
            {screen === "project" && layout === "Documents" ? (
              <section className="feature-surface">
                <DocumentsView
                  data={data}
                  reload={refresh}
                  message={setToast}
                  projectId={projectId}
                  activeId={activeDocument}
                  onActive={setActiveDocument}
                  onTask={openTask}
                />
              </section>
            ) : screen === "project" && layout === "Trash" ? (
              <section className="feature-surface">
                <TrashView
                  data={data}
                  reload={refresh}
                  message={setToast}
                  projectId={projectId}
                />
              </section>
            ) : (
              <section className="work-surface">
                <div className="project-summary">
                  <div className="summary-message">
                    <span className="sun-icon">
                      <Asterisk size={32} />
                    </span>
                    <div>
                      <strong>
                        {screen === "mywork"
                          ? "Make room for your best work."
                          : "Big ideas, moving forward."}
                      </strong>
                      <span>
                        {activeBase.length
                          ? `${activeBase.length - done} tasks to go. One great launch ahead.`
                          : "A blank canvas for something great."}
                      </span>
                    </div>
                  </div>
                  <div className="summary-progress">
                    <span>
                      <strong>{done}</strong> of {activeBase.length} tasks
                      complete{" "}
                      <b>
                        {activeBase.length
                          ? Math.round((done / activeBase.length) * 100)
                          : 0}
                        %
                      </b>
                    </span>
                    <div className="progress-track">
                      <i
                        style={{
                          width:
                            (activeBase.length
                              ? (done / activeBase.length) * 100
                              : 0) + "%",
                        }}
                      />
                    </div>
                  </div>
                  <div className="summary-divider" />
                  <div className="summary-review">
                    <span className="review-orbit">
                      <CircleDashed size={19} />
                    </span>
                    <div>
                      <strong>
                        {
                          activeBase.filter((t) => t.status === "In review")
                            .length
                        }{" "}
                        in review
                      </strong>
                      <span>Ready for a fresh perspective</span>
                    </div>
                  </div>
                </div>
                {screen === "mywork" && (
                  <div className="mywork-buckets">
                    {["Overdue", "Upcoming", "No date"].map((bucket) => (
                      <button
                        key={bucket}
                        className={dueFilter === bucket ? "selected" : ""}
                        onClick={() => {
                          setDueFilter(dueFilter === bucket ? "All" : bucket);
                        }}
                      >
                        <span>{bucket === "No date" ? "Undated" : bucket}</span>
                        <strong>
                          {
                            activeBase.filter(
                              (t) =>
                                t.status !== "Done" &&
                                (bucket === "Overdue"
                                  ? t.due && t.due < today()
                                  : bucket === "Upcoming"
                                    ? t.due && t.due >= today()
                                    : !t.due),
                            ).length
                          }
                        </strong>
                        {bucket === "Overdue" ? (
                          <Clock3 size={17} />
                        ) : (
                          <CalendarDays size={17} />
                        )}
                      </button>
                    ))}
                  </div>
                )}
                <div className="board-toolbar">
                  <div className="toolbar-left">
                    <h3>
                      {showArchive
                        ? "Archived tasks"
                        : screen === "mywork"
                          ? "Assigned to you"
                          : "All tasks"}
                      <span>{tasks.length}</span>
                    </h3>
                    <span className="toolbar-divider" />
                    <button
                      className={
                        "toolbar-button " +
                        (filters || numFilters ? "engaged" : "")
                      }
                      onClick={() => setFilters(!filters)}
                    >
                      <SlidersHorizontal size={14} />
                      Filter{numFilters > 0 && <span>{numFilters}</span>}
                    </button>
                    <label className="sort-control">
                      <ArrowUp size={13} />
                      <ArrowDown size={13} />
                      <select
                        aria-label="Sort tasks"
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                      >
                        <option value="Manual">Sort</option>
                        <option>Due date</option>
                        <option>Priority</option>
                        <option>Name</option>
                      </select>
                    </label>
                    <button
                      className="toolbar-button save-view"
                      onClick={saveView}
                    >
                      Save view
                    </button>
                  </div>
                  <div className="toolbar-right">
                    <div className="task-search">
                      <Search size={14} />
                      <input
                        aria-label="Search tasks"
                        placeholder="Search tasks..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                      {query && (
                        <button
                          className="icon-button tiny"
                          aria-label="Clear search"
                          onClick={() => setQuery("")}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                    <div className="data-menu">
                      <button
                        className="icon-button"
                        aria-label="Project data options"
                        onClick={() => setFilters(!filters)}
                      >
                        <Ellipsis size={18} />
                      </button>
                    </div>
                    {canEdit && (
                      <button
                        className="button primary add-task"
                        onClick={() => addTask()}
                      >
                        <Plus size={16} />
                        Add task
                      </button>
                    )}
                  </div>
                </div>
                {filters && (
                  <div className="filter-panel">
                    <label>
                      Status
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                      >
                        <option value="All">All statuses</option>
                        {statuses.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Priority
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                      >
                        <option value="All">All priorities</option>
                        {priorities.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Assignee
                      <select
                        value={assignee}
                        onChange={(e) => setAssignee(e.target.value)}
                      >
                        <option value="All">Everyone</option>
                        <option>Unassigned</option>
                        {data.people.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Due date
                      <select
                        aria-label="Filter due date"
                        value={dueFilter}
                        onChange={(e) => setDueFilter(e.target.value)}
                      >
                        <option value="All">Any date</option>
                        <option>Overdue</option>
                        <option>Upcoming</option>
                        <option>No date</option>
                      </select>
                    </label>
                    <label className="archive-toggle">
                      <input
                        type="checkbox"
                        checked={showArchive}
                        onChange={(e) => setShowArchive(e.target.checked)}
                      />
                      Show archived
                    </label>
                    <button
                      className="text-button"
                      onClick={() => {
                        setPriority("All");
                        setAssignee("All");
                        setStatusFilter("All");
                        setDueFilter("All");
                        setQuery("");
                        setShowArchive(false);
                      }}
                    >
                      Reset
                    </button>
                    {screen === "project" && (
                      <div className="filter-data">
                        {canEdit && (
                          <button
                            className="button"
                            onClick={() => openModal("import")}
                          >
                            <Upload size={14} />
                            Import CSV
                          </button>
                        )}
                        {canManage && (
                          <button
                            className="button"
                            onClick={() => {
                              window.location.href = "/api/export/" + projectId;
                            }}
                          >
                            <Download size={14} />
                            Export CSV
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {layout === "Overview" ? (
                  <div className="overview-grid">
                    <div className="overview-card">
                      <span className="eyebrow">THE BIG PICTURE</span>
                      <h2>
                        Every step brings
                        <br />
                        the idea closer.
                      </h2>
                      <p>
                        {project?.description ||
                          "A clear view of the work that matters to you."}
                      </p>
                      <div className="overview-stats">
                        {statuses.map((s) => (
                          <button
                            key={s}
                            onClick={() => {
                              setStatusFilter(s);
                              setLayout("List");
                            }}
                          >
                            <span className={"status-color " + statusClass(s)}>
                              <StatusIcon status={s} />
                            </span>
                            <strong>
                              {activeBase.filter((t) => t.status === s).length}
                            </strong>
                            <span>{s}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="overview-card upcoming">
                      <h3>
                        <CalendarDays size={17} />
                        Coming up next
                      </h3>
                      {activeBase
                        .filter((t) => t.status !== "Done" && t.due)
                        .sort((a, b) => a.due.localeCompare(b.due))
                        .slice(0, 5)
                        .map((t) => (
                          <button key={t.id} onClick={() => openTask(t.id)}>
                            <span
                              className={
                                "status-color " + statusClass(t.status)
                              }
                            >
                              <StatusIcon status={t.status} />
                            </span>
                            <strong>{t.title}</strong>
                            <span>{dateLabel(t.due)}</span>
                          </button>
                        ))}
                      {!activeBase.some(
                        (t) => t.status !== "Done" && t.due,
                      ) && <p>No deadlines yet. Room to breathe.</p>}
                    </div>
                  </div>
                ) : layout === "Board" ? (
                  <div className="kanban-board" aria-label="Task board">
                    {statuses.map((status) => {
                      const group = tasks.filter((t) => t.status === status);
                      return (
                        <section
                          key={status}
                          className={"kanban-column " + statusClass(status)}
                          onDragOver={(e) => {
                            if (canEdit) e.preventDefault();
                          }}
                          onDrop={async (e) => {
                            e.preventDefault();
                            const t = tasks.find(
                              (t) =>
                                t.id === e.dataTransfer.getData("text/plain"),
                            );
                            if (t && t.status !== status && canEdit)
                              await updateTask(t, { status });
                          }}
                        >
                          <header className="column-heading">
                            <span className="column-status">
                              <StatusIcon status={status} />
                              <h2>{status}</h2>
                              <b>{group.length}</b>
                            </span>
                            <div>
                              <button
                                className="icon-button tiny"
                                aria-label={"Show " + status + " in list"}
                                onClick={() => {
                                  setStatusFilter(status);
                                  setLayout("List");
                                }}
                              >
                                <Ellipsis size={16} />
                              </button>
                              {canEdit && (
                                <button
                                  className="icon-button tiny"
                                  aria-label={"Add task to " + status}
                                  onClick={() => addTask(status)}
                                >
                                  <Plus size={16} />
                                </button>
                              )}
                            </div>
                          </header>
                          <div className="column-cards">
                            {group.map(taskCard)}
                            {!group.length && (
                              <div className="empty-column">
                                <span>Room for your next idea</span>
                                <small>
                                  {canEdit
                                    ? "Add a task or move one here."
                                    : "No tasks in this stage."}
                                </small>
                              </div>
                            )}
                          </div>
                          {canEdit && !showArchive && (
                            <button
                              className="column-add"
                              onClick={() => addTask(status)}
                            >
                              <Plus size={14} />
                              Add task
                            </button>
                          )}
                        </section>
                      );
                    })}
                  </div>
                ) : (
                  <div className="task-table-wrap">
                    {canEdit && selectedTaskIds.length > 0 && (
                      <div className="bulk-action-bar">
                        <span>{selectedTaskIds.length} tasks selected</span>
                        <button
                          className="button danger"
                          disabled={busy}
                          onClick={() => deleteTasks(selectedTaskIds)}
                        >
                          <Trash2 size={14} />
                          Move selected to trash
                        </button>
                        <button
                          className="text-button"
                          onClick={() => setSelectedTaskIds([])}
                        >
                          Clear
                        </button>
                      </div>
                    )}
                    <table className="task-table">
                      <thead>
                        <tr>
                          <th>
                            {canEdit && (
                              <input
                                className="task-select"
                                type="checkbox"
                                aria-label="Select all visible tasks"
                                checked={
                                  tasks.length > 0 &&
                                  tasks.every((t) =>
                                    selectedTaskIds.includes(t.id),
                                  )
                                }
                                onChange={(e) =>
                                  setSelectedTaskIds(
                                    e.target.checked
                                      ? tasks.map((t) => t.id)
                                      : [],
                                  )
                                }
                              />
                            )}
                            Task name <span>{tasks.length}</span>
                          </th>
                          <th>Status</th>
                          <th>Assignee</th>
                          <th>Due date</th>
                          <th>Priority</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasks.map((t) => (
                          <tr key={t.id}>
                            <td>
                              <div className="task-name-cell">
                                {canEdit && (
                                  <input
                                    className="task-select"
                                    type="checkbox"
                                    aria-label={"Select " + t.title}
                                    checked={selectedTaskIds.includes(t.id)}
                                    onChange={(e) =>
                                      setSelectedTaskIds(
                                        e.target.checked
                                          ? [...selectedTaskIds, t.id]
                                          : selectedTaskIds.filter(
                                              (id) => id !== t.id,
                                            ),
                                      )
                                    }
                                  />
                                )}
                                <button onClick={() => openTask(t.id)}>
                                  <span
                                    className={
                                      "status-color " + statusClass(t.status)
                                    }
                                  >
                                    <StatusIcon status={t.status} />
                                  </span>
                                  <span>
                                    <small>{t.id}</small>
                                    {t.title}
                                    {t.parentId && (
                                      <small>Subtask of {t.parentId}</small>
                                    )}
                                  </span>
                                </button>
                              </div>
                            </td>
                            <td>
                              <span
                                className={
                                  "status-pill " + statusClass(t.status)
                                }
                              >
                                {t.status}
                              </span>
                            </td>
                            <td>
                              <span className="avatar-stack">
                                {t.assignees.map((id) => (
                                  <Avatar key={id} person={person(id)} />
                                ))}
                                {!t.assignees.length && "—"}
                              </span>
                            </td>
                            <td
                              className={
                                t.due && t.due < today() && t.status !== "Done"
                                  ? "overdue"
                                  : ""
                              }
                            >
                              {dateLabel(t.due)}
                            </td>
                            <td>
                              <span className="priority-cell">
                                <PriorityIcon priority={t.priority} />
                                {t.priority}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!tasks.length && (
                      <div className="empty-state">
                        <Search size={25} />
                        <h3>No tasks found</h3>
                        <p>
                          Try adjusting your filters or add your first task.
                        </p>
                      </div>
                    )}
                    {canEdit && (
                      <button className="column-add" onClick={() => addTask()}>
                        <Plus size={14} />
                        Add task
                      </button>
                    )}
                  </div>
                )}
                <footer className="board-footer">
                  <span>
                    <span className="footer-dot" />A shared space. A clearer
                    path forward.
                  </span>
                  <span>
                    {layout === "Board"
                      ? "Move tasks by dragging, or open one to change its status."
                      : "Made for the way your team works."}
                  </span>
                </footer>
              </section>
            )}
          </>
        )}
      </main>
      {toast && (
        <div className="toast" role="status">
          <CircleCheck size={17} />
          <span>{toast}</span>
          <button
            className="icon-button tiny"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {modal === "task" && (
        <ModalFrame
          title="A new step forward"
          subtitle={"Add a task to " + (project?.name || "your project") + "."}
          close={() => setModal(null)}
        >
          <form
            onSubmit={async (e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const result = await action(
                "tasks",
                "POST",
                {
                  projectId,
                  title: f.get("title"),
                  description: f.get("description"),
                  status: f.get("status"),
                  priority: f.get("priority"),
                  due: f.get("due"),
                  assignees: f.get("assignee") ? [f.get("assignee")] : [],
                  tags: String(f.get("tags") || "")
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                },
                "Task added. Let’s make it happen.",
              );
              if (result) {
                setModal(null);
                openTask(result.id);
              }
            }}
          >
            <label className="field">
              Task name
              <input
                name="title"
                placeholder="What needs to happen?"
                required
                maxLength={200}
              />
            </label>
            <label className="field">
              Description
              <textarea
                name="description"
                placeholder="A little context goes a long way..."
                rows={3}
              />
            </label>
            <div className="form-grid">
              <label className="field">
                Status
                <select
                  name="status"
                  aria-label="Status"
                  defaultValue={newStatus}
                >
                  {statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Priority
                <select
                  name="priority"
                  aria-label="Priority"
                  defaultValue="Normal"
                >
                  {priorities.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Assignee
                <select name="assignee" aria-label="Assignee">
                  <option value="">Unassigned</option>
                  {data.people
                    .filter((p) => project?.assigneeIds.includes(p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="field">
                Due date
                <input type="date" name="due" />
              </label>
            </div>
            <label className="field">
              Tags
              <input name="tags" placeholder="Design, Website" />
            </label>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <div className="modal-footer">
              <button
                type="button"
                className="button"
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button className="button primary" disabled={busy}>
                {busy ? (
                  <LoaderCircle size={15} className="spin" />
                ) : (
                  <Plus size={15} />
                )}
                Create task
              </button>
            </div>
          </form>
        </ModalFrame>
      )}
      {(modal === "project" || modal === "workspace") && (
        <ModalFrame
          title={
            modal === "project"
              ? "Make space for something great"
              : "Your team’s new home"
          }
          subtitle={
            modal === "project"
              ? "Bring a new project into your workspace."
              : "Create a separate workspace with a starter project."
          }
          close={() => setModal(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const r = await action(
                modal === "project" ? "projects" : "workspaces",
                "POST",
                {
                  name: f.get("name"),
                  description: f.get("description") || "",
                  workspaceId: workspace,
                  restricted: f.get("restricted") === "on",
                },
                modal === "project" ? "Project created." : "Workspace created.",
              );
              if (r) {
                if (modal === "workspace") {
                  setWorkspace(r.workspaceId);
                  openProject(r.projectId);
                } else openProject(r.id);
                setModal(null);
              }
            }}
          >
            <label className="field">
              {modal === "project" ? "Project" : "Workspace"} name
              <input
                name="name"
                placeholder={
                  modal === "project"
                    ? "The next big thing"
                    : "Your studio name"
                }
                maxLength={80}
                required
              />
            </label>
            {modal === "project" && (
              <>
                <label className="field">
                  Description
                  <textarea
                    name="description"
                    rows={3}
                    placeholder="What are we working toward?"
                  />
                </label>
                <label className="checkbox-field">
                  <input name="restricted" type="checkbox" />
                  <span>
                    <strong>Restricted project</strong>
                    <small>
                      Only people with an explicit grant can see this project.
                    </small>
                  </span>
                  <LockKeyhole size={16} />
                </label>
              </>
            )}
            {formError && <p className="form-error">{formError}</p>}
            <div className="modal-footer">
              <button
                type="button"
                className="button"
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button className="button primary" disabled={busy}>
                Create {modal}
              </button>
            </div>
          </form>
        </ModalFrame>
      )}
      {modal === "share" && project && (
        <ModalFrame
          title={"Share " + project.name}
          subtitle="Good work is a team effort."
          close={() => setModal(null)}
        >
          <div className="sharing-info">
            <LockKeyhole size={18} />
            <div>
              <strong>
                {project.restricted
                  ? "A space for your project team"
                  : "Visible to workspace members"}
              </strong>
              <p>
                {project.restricted
                  ? "Only people granted access can see this project."
                  : "Internal members can edit. Guests need an explicit grant."}
              </p>
            </div>
          </div>
          <span className="field-label">PEOPLE WITH ACCESS</span>
          <div className="share-people">
            {data.people
              .filter((p) => project.collaboratorIds.includes(p.id))
              .map((p) => (
                <div className="share-person" key={p.id}>
                  <Avatar person={p} size={34} />
                  <span>
                    <strong>
                      {p.name}
                      {p.id === data.user.id && <small> (you)</small>}
                    </strong>
                    <small>
                      {p.email}
                      {p.role === "Guest" ? " · Guest" : ""}
                    </small>
                  </span>
                  {canManage && p.id !== data.user.id ? (
                    <select
                      aria-label={"Access for " + p.name}
                      value={project.grants[p.id] || "Edit"}
                      disabled={busy}
                      onChange={(e) =>
                        action(
                          "projects/" + project.id + "/grants",
                          "POST",
                          {
                            userId: p.id,
                            grant:
                              e.target.value === "Remove"
                                ? null
                                : e.target.value,
                          },
                          "Project access updated.",
                        )
                      }
                    >
                      <option>View</option>
                      <option>Comment</option>
                      {p.role !== "Guest" && (
                        <>
                          <option>Edit</option>
                          <option>Manage</option>
                        </>
                      )}
                      {project.restricted && <option>Remove</option>}
                    </select>
                  ) : (
                    <span className="access-label">
                      {project.grants[p.id] ||
                        (p.id === data.user.id
                          ? project.access
                          : "Collaborator")}
                    </span>
                  )}
                </div>
              ))}
          </div>
          {canManage && data.people.some((p) => !project.grants[p.id]) && (
            <form
              className="add-collaborator"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                await action(
                  "projects/" + project.id + "/grants",
                  "POST",
                  { userId: f.get("userId"), grant: f.get("grant") },
                  "Collaborator added.",
                );
              }}
            >
              <label className="field">
                Add an existing collaborator
                <select name="userId">
                  {data.people
                    .filter((p) => !project.grants[p.id])
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.role}
                      </option>
                    ))}
                </select>
              </label>
              <div className="add-collaborator-row">
                <select name="grant" aria-label="Access level">
                  <option>Comment</option>
                  <option>View</option>
                </select>
                <button className="button primary" disabled={busy}>
                  <Plus size={14} />
                  Grant access
                </button>
              </div>
            </form>
          )}
          <p className="demo-explanation">
            {desktop && "Desktop data stays on this device. "}Demo accounts
            only. Email invitations are not connected. Switch accounts from your
            profile to try reviewer access.
          </p>
          <div className="modal-footer">
            {!desktop && (
              <button
                className="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      location.origin + "/?project=" + project.id,
                    );
                    setToast(
                      "Project link copied. Recipients still need access.",
                    );
                  } catch {
                    setToast(
                      "Clipboard unavailable. Copy the address from your browser.",
                    );
                  }
                }}
              >
                <Link2 size={14} />
                Copy link
              </button>
            )}
            <button className="button primary" onClick={() => setModal(null)}>
              Done
            </button>
          </div>
        </ModalFrame>
      )}
      {modal === "search" && (
        <ModalFrame
          title="Find your next step"
          subtitle="Search the tasks you have access to in this workspace."
          close={() => setModal(null)}
          wide
        >
          <UniversalSearch
            data={data}
            workspace={workspace}
            onTask={(id) => {
              setModal(null);
              openTask(id);
            }}
            onDocument={openDocument}
          />
        </ModalFrame>
      )}
      {modal === "import" && (
        <ModalFrame
          title="Bring your work along"
          subtitle="Preview a CSV before adding tasks to this project."
          close={() => setModal(null)}
          wide
        >
          <div className="csv-guidance">
            <Upload size={22} />
            <div>
              <strong>A fresh start, without starting over.</strong>
              <p>
                Required: Title. Optional: Description, Status, Priority, Due
                date (YYYY-MM-DD), Tags (separated by semicolons). Up to 500
                rows.
              </p>
            </div>
          </div>
          <label className="file-picker">
            Choose CSV file
            <input
              aria-label="Choose CSV file"
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  if (f.size > 500000) {
                    setFormError("Choose a CSV smaller than 500 KB.");
                    return;
                  }
                  setCsv(await f.text());
                  setPreview(null);
                  setFormError("");
                }
              }}
            />
          </label>
          <label className="field">
            Or paste CSV
            <textarea
              rows={5}
              value={csv}
              onChange={(e) => {
                setCsv(e.target.value);
                setPreview(null);
              }}
              placeholder={"Title,Status,Priority\nA new idea,To do,Normal"}
            />
          </label>
          {preview && (
            <div className="import-preview">
              <strong>{preview.length} tasks ready to import</strong>
              {preview.slice(0, 8).map((t, i) => (
                <div key={i}>
                  <span>{t.title}</span>
                  <span
                    className={
                      "status-pill " + statusClass(t.status || "To do")
                    }
                  >
                    {t.status}
                  </span>
                </div>
              ))}
              {preview.length > 8 && (
                <p>And {preview.length - 8} more tasks.</p>
              )}
            </div>
          )}
          {formError && <p className="form-error">{formError}</p>}
          <div className="modal-footer">
            <button className="button" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button
              className="button primary"
              disabled={busy || !csv}
              onClick={async () => {
                if (preview) {
                  const r = await action("import", "POST", {
                    projectId,
                    csv,
                    commit: true,
                    operationId: importKey.current,
                  });
                  if (r) {
                    setModal(null);
                    setToast(`${r.count} tasks imported.`);
                  }
                } else {
                  const r = await action("import", "POST", {
                    projectId,
                    csv,
                    commit: false,
                  });
                  if (r) setPreview(r.preview);
                }
              }}
            >
              {preview ? "Import tasks" : "Preview import"}
              <ArrowRight size={14} />
            </button>
          </div>
        </ModalFrame>
      )}
      {modal === "help" && (
        <ModalFrame
          title="A little more in sync"
          subtitle="Welcome to your Relaywork demonstration."
          close={() => setModal(null)}
        >
          <div className="help-content">
            <Brand />
            <p>
              This is a working local prototype of a shared project workspace.
              Your tasks, comments, and project access are saved on this server.
            </p>
            <ol>
              <li>
                <strong>Make your next move.</strong> Add a task, assign a
                teammate, and choose a due date.
              </li>
              <li>
                <strong>Keep work moving.</strong> Drag a card across the board,
                or change its status from task details.
              </li>
              <li>
                <strong>Bring in another perspective.</strong> Jordan is a guest
                reviewer with comment access to Brand launch. Switch demo
                accounts using your profile.
              </li>
              <li>
                <strong>Take your work with you.</strong> Open Filter for CSV
                import, export, and your saved personal view.
              </li>
            </ol>
            <p className="demo-explanation">
              This demo uses sample accounts, not production sign-in. Email
              invitations, cloud sync, and real-time multi-user collaboration
              are not connected. Do not use it for confidential data.
            </p>
            <p className="keyboard-tip">
              <kbd>⌘</kbd> + <kbd>K</kbd> Search anywhere
            </p>
          </div>
          <div className="modal-footer">
            <button className="button primary" onClick={() => setModal(null)}>
              Let’s get to work
              <ArrowRight size={14} />
            </button>
          </div>
        </ModalFrame>
      )}
      {selectedTask && selectedProject && (
        <TaskDetail
          key={selectedTask.id}
          task={selectedTask}
          project={selectedProject}
          data={data}
          tab={detailTab}
          setTab={setDetailTab}
          close={() => setSelected(null)}
          update={updateTask}
          action={action}
          busy={busy}
          reload={refresh}
          message={setToast}
          onTask={openTask}
          onDocument={openDocument}
          onDelete={() => deleteTasks([selectedTask.id])}
        />
      )}
    </div>
  );
}
function TaskDetail({
  task,
  project,
  data,
  tab,
  setTab,
  close,
  update,
  action,
  busy,
  reload,
  message,
  onTask,
  onDocument,
  onDelete,
}: {
  reload: () => Promise<unknown>;
  message: (text: string) => void;
  onTask: (id: string) => void;
  onDocument: (id: string) => void;
  onDelete: () => Promise<void>;
  task: Task;
  project: ProjectView;
  data: Data;
  tab: string;
  setTab: (s: string) => void;
  close: () => void;
  update: (t: Task, f: Partial<Task>) => Promise<unknown>;
  action: (p: string, m: string, b: unknown, msg?: string) => Promise<unknown>;
  busy: boolean;
}) {
  const [title, setTitle] = useState(task.title),
    [description, setDescription] = useState(task.description),
    [comment, setComment] = useState(""),
    [item, setItem] = useState(""),
    [tags, setTags] = useState(task.tags.join(", "));
  const [editError, setEditError] = useState("");
  const [checklist, setChecklist] = useState(task.checklist);
  useEffect(() => setChecklist(task.checklist), [task.version, task.checklist]);
  const writable =
      ["Edit", "Manage"].includes(project.access) && !task.archived,
    commentable = project.access !== "View" && !task.archived;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    ref.current?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const els = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button,input,textarea,select,[tabindex="0"]',
          ) || [],
        ).filter((el) => !el.hasAttribute("disabled"));
        const first = els[0],
          last = els.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.removeEventListener("keydown", listener);
      prev?.focus();
    };
  }, []);
  const people = (id: string) => data.people.find((p) => p.id === id);
  const comments = data.comments.filter((c) => c.taskId === task.id),
    events = data.activity.filter((a) => a.taskId === task.id);
  async function save() {
    const r = await update(task, {
      title,
      description,
      tags: tags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    if (r) setEditError("");
    else
      setEditError(
        "Your draft has been kept. If the task changed, copy your draft and reopen it to load the latest version.",
      );
  }
  return (
    <div
      className="detail-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        ref={ref}
        tabIndex={-1}
        className="task-detail"
        role="dialog"
        aria-modal="true"
        aria-label={"Task " + task.id}
      >
        <header className="detail-header">
          <span>
            <Folder size={15} />
            {project.name}
            <ChevronRight size={12} />
            <strong>{task.id}</strong>
          </span>
          <div>
            {["Edit", "Manage"].includes(project.access) && (
              <button
                className="icon-button"
                aria-label="Delete task"
                disabled={busy}
                onClick={() => void onDelete()}
              >
                <Trash2 size={17} />
              </button>
            )}
            {project.access === "Manage" && (
              <button
                className="icon-button"
                aria-label={task.archived ? "Restore task" : "Archive task"}
                disabled={busy}
                onClick={async () => {
                  if (await update(task, { archived: !task.archived })) close();
                }}
              >
                <Archive size={17} />
              </button>
            )}
            <button
              className="icon-button"
              aria-label="Close task"
              onClick={close}
            >
              <X size={20} />
            </button>
          </div>
        </header>
        <div className="detail-scroll">
          {task.archived && (
            <div className="archive-banner">
              <Archive size={16} />
              This task is archived. Restore it to continue working.
            </div>
          )}
          <div className="detail-title-block">
            <span className="eyebrow">
              {task.id} <span> / </span> {project.name}
            </span>
            {writable ? (
              <input
                className="detail-title-input"
                aria-label="Task title"
                value={title}
                maxLength={200}
                onChange={(e) => setTitle(e.target.value)}
              />
            ) : (
              <h2>{task.title}</h2>
            )}
          </div>
          <div className="detail-fields">
            <label>
              <span>
                <CircleDashed size={15} />
                Status
              </span>
              <select
                aria-label="Task status"
                className={"status-select " + statusClass(task.status)}
                value={task.status}
                disabled={!writable || busy}
                onChange={(e) =>
                  update(task, { status: e.target.value as Task["status"] })
                }
              >
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              <span>
                <Users size={15} />
                Assignees
              </span>
              <div className="assignee-editor">
                {task.assignees.map((id) => (
                  <Avatar key={id} person={people(id)} size={25} />
                ))}
                {writable ? (
                  <select
                    aria-label="Add or remove assignee"
                    value=""
                    disabled={busy}
                    onChange={(e) => {
                      const id = e.target.value;
                      if (id)
                        update(task, {
                          assignees: task.assignees.includes(id)
                            ? task.assignees.filter((a) => a !== id)
                            : [...task.assignees, id],
                        });
                    }}
                  >
                    <option value="">
                      {task.assignees.length ? "Edit assignees" : "Unassigned"}
                    </option>
                    {data.people
                      .filter((p) => project.assigneeIds.includes(p.id))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {task.assignees.includes(p.id) ? "✓ Remove " : "Add "}
                          {p.name}
                        </option>
                      ))}
                  </select>
                ) : (
                  <span>
                    {task.assignees.map((id) => people(id)?.name).join(", ") ||
                      "Unassigned"}
                  </span>
                )}
              </div>
            </label>
            <label>
              <span>
                <CalendarDays size={15} />
                Due date
              </span>
              <input
                type="date"
                aria-label="Task due date"
                value={task.due}
                disabled={!writable || busy}
                onChange={(e) => update(task, { due: e.target.value })}
              />
            </label>
            <label>
              <span>
                <Flag size={15} />
                Priority
              </span>
              <div className="priority-select">
                <PriorityIcon priority={task.priority} />
                <select
                  aria-label="Task priority"
                  value={task.priority}
                  disabled={!writable || busy}
                  onChange={(e) =>
                    update(task, {
                      priority: e.target.value as Task["priority"],
                    })
                  }
                >
                  {priorities.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
            </label>
          </div>
          <div className="detail-section">
            <h3>Description</h3>
            {writable ? (
              <textarea
                className="description-editor"
                aria-label="Task description"
                value={description}
                placeholder="Give your team a little context…"
                rows={4}
                onChange={(e) => setDescription(e.target.value)}
              />
            ) : (
              <p className="description-readonly">
                {task.description || "No description yet."}
              </p>
            )}
            <label className="detail-tags-label">
              Tags
              {writable ? (
                <input
                  aria-label="Task tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="Add tags, separated by commas"
                />
              ) : (
                <div className="tag-row">
                  {task.tags.map((t) => (
                    <span key={t} className="tag tag-purple">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </label>
            {writable &&
              (title !== task.title ||
                description !== task.description ||
                tags !== task.tags.join(", ")) && (
                <div className="draft-actions">
                  <span>Unsaved changes</span>
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => {
                      setTitle(task.title);
                      setDescription(task.description);
                      setTags(task.tags.join(", "));
                      setEditError("");
                    }}
                  >
                    Discard
                  </button>
                  <button
                    className="button primary"
                    disabled={busy || !title.trim()}
                    onClick={save}
                  >
                    Save changes
                  </button>
                </div>
              )}
            {editError && <p className="form-error">{editError}</p>}
          </div>
          <div className="detail-section">
            <h3>
              Checklist{" "}
              <span>
                {checklist.filter((c) => c.done).length}/{checklist.length}
              </span>
            </h3>
            {checklist.map((c) => (
              <label
                className={"checklist-item " + (c.done ? "is-done" : "")}
                key={c.id}
              >
                <input
                  type="checkbox"
                  checked={c.done}
                  disabled={!writable || busy}
                  onChange={async () => {
                    const next = checklist.map((i) =>
                      i.id === c.id ? { ...i, done: !i.done } : i,
                    );
                    setChecklist(next);
                    if (!(await update(task, { checklist: next })))
                      setChecklist(task.checklist);
                  }}
                />
                <span>{c.text}</span>
                {writable && (
                  <button
                    className="icon-button tiny"
                    aria-label={"Remove " + c.text}
                    disabled={busy}
                    onClick={() =>
                      update(task, {
                        checklist: checklist.filter((i) => i.id !== c.id),
                      })
                    }
                  >
                    <X size={12} />
                  </button>
                )}
              </label>
            ))}
            {writable && (
              <form
                className="add-checklist"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    item.trim() &&
                    (await update(task, {
                      checklist: [
                        ...task.checklist,
                        {
                          id: crypto.randomUUID(),
                          text: item.trim(),
                          done: false,
                        },
                      ],
                    }))
                  )
                    setItem("");
                }}
              >
                <Plus size={14} />
                <input
                  aria-label="New checklist item"
                  placeholder="Add a checklist item"
                  value={item}
                  maxLength={300}
                  onChange={(e) => setItem(e.target.value)}
                />
                {item && (
                  <button className="text-button" disabled={busy}>
                    Add
                  </button>
                )}
              </form>
            )}
            {!checklist.length && !writable && (
              <p className="muted">No checklist items.</p>
            )}
          </div>
          <TaskExtras
            data={data}
            reload={reload}
            message={message}
            task={task}
            editable={writable}
            onTask={onTask}
            onDocument={onDocument}
          />
          <div className="detail-tabs">
            <button
              className={tab === "Comments" ? "selected" : ""}
              onClick={() => setTab("Comments")}
            >
              <MessageSquare size={15} />
              Comments <span>{comments.length}</span>
            </button>
            <button
              className={tab === "Activity" ? "selected" : ""}
              onClick={() => setTab("Activity")}
            >
              <Activity size={15} />
              Activity <span>{events.length}</span>
            </button>
          </div>
          <div className="conversation">
            {tab === "Comments" ? (
              <>
                {comments.map((c) => (
                  <article key={c.id} className="comment">
                    <Avatar person={people(c.authorId)} size={30} />
                    <div>
                      <header>
                        <strong>
                          {people(c.authorId)?.name || "Teammate"}
                        </strong>
                        <time>
                          {new Date(c.createdAt).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </time>
                      </header>
                      <p>{c.body}</p>
                    </div>
                  </article>
                ))}
                {!comments.length && (
                  <div className="conversation-empty">
                    <MessageSquare size={22} />
                    <strong>Start a conversation</strong>
                    <p>A question, a thought, a fresh perspective.</p>
                  </div>
                )}
              </>
            ) : (
              <>
                {events
                  .slice()
                  .reverse()
                  .map((a) => (
                    <div className="activity-row" key={a.id}>
                      <span className="activity-dot" />
                      <p>
                        <strong>{people(a.actorId)?.name}</strong> {a.text}
                        <time>{new Date(a.createdAt).toLocaleString()}</time>
                      </p>
                    </div>
                  ))}
                {!events.length && (
                  <p className="muted">New task updates will appear here.</p>
                )}
              </>
            )}
          </div>
        </div>
        {commentable ? (
          <form
            className="comment-composer"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await action(
                  "tasks/" + task.id + "/comments",
                  "POST",
                  { body: comment },
                  "Comment posted.",
                )
              )
                setComment("");
            }}
          >
            <Avatar person={data.user} size={29} />
            <textarea
              aria-label="Write a comment"
              value={comment}
              maxLength={5000}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share a thought or leave some feedback…"
              rows={2}
            />
            <button
              className="button primary"
              disabled={busy || !comment.trim()}
              aria-label="Post comment"
            >
              <Send size={16} />
            </button>
          </form>
        ) : (
          <div className="read-only-note">
            <LockKeyhole size={14} />
            {task.archived
              ? "Archived tasks are read-only."
              : "You have view access to this project."}
          </div>
        )}
      </section>
    </div>
  );
}
