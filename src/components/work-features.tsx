"use client";
import { useState, useEffect, useRef, type ReactNode } from "react";
import {
  useEditor,
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import {
  Plus,
  Trash2,
  RotateCcw,
  FileText,
  Paperclip,
  Download,
  ImagePlus,
  Search,
  History,
  Link2,
  Bell,
  Check,
  X,
  ArrowUpRight,
  Bold,
  Italic,
  List,
  ListOrdered,
  Table2,
  CheckSquare,
  Heading2,
  Undo,
  Redo,
  LoaderCircle,
} from "lucide-react";
import type {
  Person,
  Project,
  Task,
  ProjectDocument,
  FileAttachment,
  DocumentLink,
  Reminder,
  DocumentRevision,
  RichNode,
} from "@/lib/model";
import { textOf } from "@/lib/features";
export type FeatureData = {
  user: Person;
  people: Person[];
  projects: (Project & { access: string })[];
  tasks: Task[];
  documents: ProjectDocument[];
  attachments: FileAttachment[];
  documentLinks: DocumentLink[];
  reminders: Reminder[];
};
type Shared = {
  data: FeatureData;
  reload: () => Promise<unknown>;
  message: (text: string) => void;
};
async function request<T = Record<string, unknown>>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const res = await fetch("/api/" + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const result = await res.json();
  if (!res.ok)
    throw Error(result.error || "The action could not be completed.");
  return result;
}
async function upload(
  file: File,
  target: { taskId?: string; documentId?: string },
): Promise<FileAttachment> {
  const form = new FormData();
  form.set("file", file);
  if (target.taskId) form.set("taskId", target.taskId);
  if (target.documentId) form.set("documentId", target.documentId);
  const r = await fetch("/api/files", { method: "POST", body: form });
  const f = await r.json();
  if (!r.ok) throw Error(f.error || "Upload failed.");
  return f;
}
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong.";
const when = (v: string) => new Date(v).toLocaleString();
export function FilePanel({
  data,
  reload,
  message,
  taskId,
  documentId,
  editable,
  onImage,
}: {
  taskId?: string;
  documentId?: string;
  editable: boolean;
  onImage?: (f: FileAttachment) => void;
} & Shared) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const files = data.attachments.filter((f) =>
    taskId ? f.taskId === taskId : f.documentId === documentId,
  );
  async function add(list: FileList | null) {
    if (!list) return;
    setBusy(true);
    setError("");
    try {
      for (const file of Array.from(list)) {
        const f = await upload(file, { taskId, documentId });
        if (f.mime.startsWith("image/")) onImage?.(f);
      }
      await reload();
      message("Files uploaded.");
    } catch (e) {
      setError(errorText(e));
      await reload();
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="feature-section attachment-panel"
      onDragOver={(e) => {
        if (editable) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(e) => {
        if (editable && e.dataTransfer.files.length) {
          e.preventDefault();
          e.stopPropagation();
          void add(e.dataTransfer.files);
        }
      }}
    >
      <div className="feature-section-title">
        <h3>
          <Paperclip size={15} />
          Files <span>{files.length}</span>
        </h3>
        {editable && (
          <label className={"button upload-button " + (busy ? "disabled" : "")}>
            <Plus size={14} />
            {busy ? "Uploading…" : "Add files"}
            <input
              aria-label={
                documentId ? "Upload document files" : "Upload task files"
              }
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
              multiple
              disabled={busy}
              onChange={(e) => {
                void add(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
      {editable && (
        <p className="feature-hint">
          Drop images or PDFs here · Up to 25 MB per file
        </p>
      )}
      <div className="attachment-list">
        {files.map((f) => (
          <div className="attachment-item" key={f.id}>
            {f.mime.startsWith("image/") ? (
              <img src={"/api/files/" + f.id} alt="" loading="lazy" />
            ) : (
              <span className="file-symbol">
                <FileText size={21} />
              </span>
            )}
            <span>
              <strong>{f.name}</strong>
              <small>
                {Math.max(1, Math.round(f.size / 1024))} KB ·{" "}
                {f.mime === "application/pdf" ? "PDF" : "Image"}
              </small>
            </span>
            {documentId && f.mime.startsWith("image/") && editable && (
              <button
                className="icon-button"
                aria-label={"Insert " + f.name + " into document"}
                onClick={() => onImage?.(f)}
              >
                <ImagePlus size={16} />
              </button>
            )}
            <a
              className="icon-button"
              aria-label={"Download " + f.name}
              href={"/api/files/" + f.id + "?download=1"}
            >
              <Download size={15} />
            </a>
            {editable && (
              <button
                className="icon-button"
                aria-label={"Remove " + f.name}
                disabled={busy}
                onClick={async () => {
                  try {
                    await request("files/" + f.id, "DELETE");
                    await reload();
                  } catch (e) {
                    setError(errorText(e));
                  }
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
export function TrashView({
  data,
  reload,
  message,
  projectId,
}: Shared & { projectId: string }) {
  const [ids, setIds] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const tasks = data.tasks.filter(
    (t) => t.projectId === projectId && t.deletedAt,
  );
  async function restore(values: string[]) {
    setBusy(true);
    setError("");
    try {
      const r = await request<{ count: number }>("trash", "POST", {
        ids: values,
        operation: "restore",
      });
      setIds([]);
      await reload();
      message(`${r.count} task(s) restored.`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="trash-view">
      <div className="feature-page-title">
        <div>
          <h2>
            <Trash2 size={21} />
            Trash
          </h2>
          <p>
            Deleted tasks are kept here until you restore them. Nothing is
            permanently erased.
          </p>
        </div>
        {ids.length > 0 && (
          <button
            className="button primary"
            disabled={busy}
            onClick={() => restore(ids)}
          >
            <RotateCcw size={14} />
            Restore selected ({ids.length})
          </button>
        )}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!tasks.length ? (
        <div className="empty-state">
          <Trash2 size={27} />
          <h3>The trash is empty</h3>
          <p>Deleted tasks can be recovered here.</p>
        </div>
      ) : (
        <div className="trash-list">
          <label className="bulk-check">
            <input
              type="checkbox"
              aria-label="Select all deleted tasks"
              checked={tasks.every((t) => ids.includes(t.id))}
              onChange={(e) =>
                setIds(e.target.checked ? tasks.map((t) => t.id) : [])
              }
            />
            Select all
          </label>
          {tasks.map((t) => (
            <div key={t.id} className="trash-row">
              <input
                type="checkbox"
                aria-label={"Select deleted " + t.title}
                checked={ids.includes(t.id)}
                onChange={(e) =>
                  setIds(
                    e.target.checked
                      ? [...ids, t.id]
                      : ids.filter((i) => i !== t.id),
                  )
                }
              />
              <div>
                <strong>{t.title}</strong>
                <small>
                  {t.id}
                  {t.parentId ? " · Subtask of " + t.parentId : ""} · Deleted{" "}
                  {when(t.deletedAt!)}
                </small>
              </div>
              <button
                className="button"
                disabled={busy}
                onClick={() => restore([t.id])}
              >
                <RotateCcw size={13} />
                Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
export function TaskExtras({
  data,
  reload,
  message,
  task,
  editable,
  onTask,
  onDocument,
}: Shared & {
  task: Task;
  editable: boolean;
  onTask: (id: string) => void;
  onDocument: (id: string) => void;
}) {
  const [subtask, setSubtask] = useState(""),
    [link, setLink] = useState(""),
    [due, setDue] = useState(""),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const children = data.tasks.filter(
      (t) => t.parentId === task.id && !t.deletedAt,
    ),
    links = data.documentLinks.filter((l) => l.taskId === task.id),
    linkedIds = new Set(links.map((l) => l.documentId));
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="feature-section">
        <div className="feature-section-title">
          <h3>
            Subtasks <span>{children.length}</span>
            {task.parentId && (
              <button
                className="text-button"
                onClick={() => onTask(task.parentId!)}
              >
                Open parent task
              </button>
            )}
          </h3>
        </div>
        {children.map((t) => (
          <button
            className="related-row"
            key={t.id}
            onClick={() => onTask(t.id)}
          >
            <span
              className={
                "status-pill " + t.status.toLowerCase().replaceAll(" ", "-")
              }
            >
              {t.status}
            </span>
            <strong>{t.title}</strong>
            <ArrowUpRight size={14} />
          </button>
        ))}
        {editable && !task.parentId && (
          <form
            className="inline-feature-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await request("tasks/" + task.id + "/subtasks", "POST", {
                  title: subtask,
                });
                setSubtask("");
              });
            }}
          >
            <input
              aria-label="Subtask title"
              value={subtask}
              required
              maxLength={200}
              placeholder="Break this work into a smaller step…"
              onChange={(e) => setSubtask(e.target.value)}
            />
            <button className="button" disabled={busy || !subtask.trim()}>
              <Plus size={14} />
              Add subtask
            </button>
          </form>
        )}
      </section>
      <section className="feature-section">
        <h3>
          <FileText size={15} />
          Linked documents
        </h3>
        {data.documents
          .filter((d) => linkedIds.has(d.id))
          .map((d) => (
            <div className="linked-document" key={d.id}>
              <button onClick={() => onDocument(d.id)}>
                <FileText size={16} />
                {d.title}
                <ArrowUpRight size={13} />
              </button>
              {editable && (
                <button
                  className="icon-button"
                  aria-label={"Unlink " + d.title}
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      request("documents/" + d.id + "/links", "DELETE", {
                        taskId: task.id,
                      }),
                    )
                  }
                >
                  <X size={13} />
                </button>
              )}
            </div>
          ))}
        {editable && (
          <form
            className="inline-feature-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await request("documents/" + link + "/links", "POST", {
                  taskId: task.id,
                });
                setLink("");
              });
            }}
          >
            <select
              aria-label="Document to link"
              value={link}
              required
              onChange={(e) => setLink(e.target.value)}
            >
              <option value="">Choose a project document…</option>
              {data.documents
                .filter(
                  (d) => d.projectId === task.projectId && !linkedIds.has(d.id),
                )
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
            </select>
            <button className="button" disabled={busy || !link}>
              <Link2 size={13} />
              Link
            </button>
          </form>
        )}
      </section>
      <FilePanel
        data={data}
        reload={reload}
        message={message}
        taskId={task.id}
        editable={editable}
      />
      {!task.archived && (
        <section className="feature-section">
          <h3>
            <Bell size={15} />
            My reminders
          </h3>
          <p className="feature-hint">
            Shown in your inbox while Relaywork is open, or when you next open
            it. Times use your computer’s timezone.
          </p>
          {data.reminders
            .filter((r) => r.taskId === task.id)
            .map((r) => (
              <div className="reminder-row" key={r.id}>
                <Bell size={14} />
                <div>
                  <strong>{when(r.dueAt)}</strong>
                  <small>
                    {r.deliveredAt ? "Delivered" : r.note || "Pending"}
                  </small>
                </div>
                <button
                  className="icon-button"
                  aria-label="Cancel reminder"
                  onClick={() =>
                    run(() => request("reminders/" + r.id, "DELETE"))
                  }
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          <form
            className="reminder-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await request("reminders", "POST", {
                  taskId: task.id,
                  dueAt: new Date(due).toISOString(),
                  note,
                });
                setDue("");
                setNote("");
                message("Reminder scheduled.");
              });
            }}
          >
            <label>
              Remind me at
              <input
                aria-label="Reminder time"
                type="datetime-local"
                value={due}
                required
                onChange={(e) => setDue(e.target.value)}
              />
            </label>
            <label>
              Note (optional)
              <input
                aria-label="Reminder note"
                maxLength={300}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <button className="button" disabled={busy || !due}>
              <Bell size={13} />
              Set reminder
            </button>
          </form>
        </section>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
function EditableImage({
  node,
  updateAttributes,
  editor,
  deleteNode,
}: NodeViewProps) {
  return (
    <NodeViewWrapper
      as="figure"
      className="document-image"
      contentEditable={false}
      style={{ width: "100%" }}
    >
      <img
        src={node.attrs.src}
        alt={node.attrs.alt || ""}
        style={{ width: (Number(node.attrs.width) || 100) + "%" }}
      />
      {editor.isEditable ? (
        <div className="image-controls">
          <label>
            Width
            <input
              aria-label="Image width"
              type="range"
              min="20"
              max="100"
              value={node.attrs.width || 100}
              onChange={(e) =>
                updateAttributes({ width: Number(e.target.value) })
              }
            />
            <span>{node.attrs.width || 100}%</span>
          </label>
          <input
            aria-label="Image caption"
            maxLength={500}
            placeholder="Add a caption…"
            value={node.attrs.caption || ""}
            onChange={(e) =>
              updateAttributes({ caption: e.target.value, alt: e.target.value })
            }
          />
          <button
            type="button"
            className="icon-button"
            aria-label="Remove image from document"
            onClick={deleteNode}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        node.attrs.caption && <figcaption>{node.attrs.caption}</figcaption>
      )}
    </NodeViewWrapper>
  );
}
const DocumentImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: 100 },
      caption: { default: "" },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(EditableImage);
  },
});
const extensions = () => [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: false, autolink: false },
  }),
  DocumentImage,
  TableKit,
  TaskList,
  TaskItem.configure({ nested: false }),
];
type EditorHandle = {
  flush: () => Promise<boolean>;
  insertImage: (f: FileAttachment) => void;
};
function DocumentEditor({
  doc,
  editable,
  data,
  reload,
  message,
  handle,
  onHistory,
  onTask,
}: Shared & {
  doc: ProjectDocument;
  editable: boolean;
  handle: React.MutableRefObject<EditorHandle | null>;
  onHistory: () => void;
  onTask: (id: string) => void;
}) {
  const key = `relaywork-draft-${data.user.id}-${doc.id}`;
  const [title, setTitle] = useState(doc.title),
    [status, setStatus] = useState("Saved"),
    [error, setError] = useState(""),
    [linkInput, setLinkInput] = useState(""),
    [linkDialog, setLinkDialog] = useState(false);
  const titleRef = useRef(doc.title),
    version = useRef(doc.version),
    dirty = useRef(false),
    saving = useRef<Promise<boolean> | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    mounted = useRef(true),
    lastSaved = useRef(""),
    editorRef = useRef<ReturnType<typeof useEditor>>(null);
  const draft = () => ({
    title: titleRef.current,
    body: editorRef.current?.getJSON() as RichNode,
    version: version.current,
  });
  const backup = () => {
    try {
      localStorage.setItem(key, JSON.stringify(draft()));
    } catch {}
  };
  function changed() {
    if (!editable) return;
    dirty.current = true;
    backup();
    setStatus("Unsaved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), 800);
  }
  async function save(): Promise<boolean> {
    if (saving.current) {
      await saving.current;
      if (dirty.current) return save();
      return true;
    }
    if (!dirty.current || !editorRef.current) return true;
    const value = draft();
    if (!value.title.trim()) {
      setStatus("Not saved");
      setError("Give your document a title.");
      return false;
    }
    const hash = JSON.stringify({ title: value.title, body: value.body });
    if (hash === lastSaved.current) {
      dirty.current = false;
      setStatus("Saved");
      return true;
    }
    if (mounted.current) {
      setStatus("Saving…");
      setError("");
    }
    const promise = (async () => {
      try {
        const updated = await request<ProjectDocument>(
          "documents/" + doc.id,
          "PATCH",
          value,
        );
        version.current = updated.version;
        lastSaved.current = hash;
        const current = draft();
        const unchanged =
          JSON.stringify({ title: current.title, body: current.body }) === hash;
        dirty.current = !unchanged;
        if (unchanged) localStorage.removeItem(key);
        else backup();
        if (mounted.current) setStatus(unchanged ? "Saved" : "Unsaved");
        await reload();
        return true;
      } catch (e) {
        backup();
        if (mounted.current) {
          setStatus("Not saved");
          setError(errorText(e));
        }
        return false;
      } finally {
        saving.current = null;
      }
    })();
    saving.current = promise;
    return promise;
  }
  function insertUploadedImage(file: FileAttachment) {
    const current = editorRef.current;
    if (!current) return;
    current
      .chain()
      .focus()
      .insertContentAt(current.state.selection.to, {
        type: "image",
        attrs: { src: "/api/files/" + file.id, alt: file.name },
      })
      .run();
  }
  async function flushEdits(): Promise<boolean> {
    while (dirty.current) {
      if (!(await save())) return false;
    }
    return true;
  }
  async function uploadIntoEditor(files: File[]) {
    if (!editable) return;
    try {
      for (const file of files) {
        const f = await upload(file, { documentId: doc.id });
        if (f.mime.startsWith("image/")) insertUploadedImage(f);
      }
      await reload();
    } catch (e) {
      setError(errorText(e));
    }
  }
  const editor = useEditor({
    extensions: extensions(),
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editable,
    content: doc.body,
    editorProps: {
      handleClick(_view, _position, event) {
        const link = (event.target as HTMLElement).closest("a");
        if (
          link &&
          (!editorRef.current?.isEditable || event.ctrlKey || event.metaKey)
        ) {
          const href = link.getAttribute("href") || "";
          if (/^(https?:\/\/|mailto:)/i.test(href)) {
            event.preventDefault();
            window.open(href, "_blank", "noopener,noreferrer");
            return true;
          }
        }
        return false;
      },
      attributes: {
        class: "document-prose",
        role: "textbox",
        "aria-label": "Document content",
        "aria-multiline": "true",
      },
      handlePaste(_view, event) {
        const files = Array.from(event.clipboardData?.files || []);
        if (editable && files.length) {
          event.preventDefault();
          void uploadIntoEditor(files);
          return true;
        }
        return false;
      },
    },
    onUpdate() {
      changed();
    },
  });
  editorRef.current = editor;
  useEffect(() => {
    if (!editor) return;
    mounted.current = true;
    lastSaved.current = JSON.stringify({ title: doc.title, body: doc.body });
    if (editable) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const recovered = JSON.parse(raw);
          if (recovered.body) {
            editor.commands.setContent(recovered.body, { emitUpdate: false });
            setTitle(recovered.title);
            titleRef.current = recovered.title;
            version.current = recovered.version;
            dirty.current = true;
            setStatus("Recovered local draft");
            if (recovered.version !== doc.version)
              setError(
                "A local draft and a newer saved version exist. Download your draft before loading the latest version.",
              );
            else timer.current = setTimeout(() => void save(), 800);
          }
        }
      } catch {}
    }
    const unsubscribe = window.relayworkDesktop?.onBeforeQuit(flushEdits);
    const flush = () => void save();
    const before = (event: BeforeUnloadEvent) => {
      if (dirty.current) {
        backup();
        event.preventDefault();
      }
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("beforeunload", before);
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (dirty.current) {
        backup();
        void save().finally(() => unsubscribe?.());
      } else unsubscribe?.();
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("beforeunload", before);
    };
  }, [editor]);
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);
  useEffect(() => {
    if (!editor || doc.version <= version.current || saving.current) return;
    if (dirty.current) {
      setError("This document changed elsewhere. Your draft has been kept.");
      setStatus("Not saved");
    } else {
      version.current = doc.version;
      titleRef.current = doc.title;
      setTitle(doc.title);
      editor.commands.setContent(doc.body, { emitUpdate: false });
      lastSaved.current = JSON.stringify({ title: doc.title, body: doc.body });
    }
  }, [doc.version, editor]);
  useEffect(() => {
    handle.current = {
      flush: flushEdits,
      insertImage: insertUploadedImage,
    };
    return () => {
      handle.current = null;
    };
  });
  if (!editor)
    return (
      <div className="empty-state">
        <LoaderCircle className="spin" size={23} />
        Opening document…
      </div>
    );
  const tool = (
    label: string,
    icon: ReactNode,
    fn: () => void,
    active = false,
  ) => (
    <button
      type="button"
      className={"editor-tool " + (active ? "active" : "")}
      aria-label={label}
      title={label}
      onClick={fn}
    >
      {icon}
    </button>
  );
  return (
    <section className="document-editor">
      <div className="document-topline">
        <span>{doc.id}</span>
        <span
          role="status"
          className={status === "Not saved" ? "save-error" : ""}
        >
          {status === "Saved" && <Check size={13} />} {status}
        </span>
        <button
          className="button"
          onClick={async () => {
            if (await save()) onHistory();
          }}
        >
          <History size={14} />
          History
        </button>
      </div>
      {editable ? (
        <input
          className="document-title"
          aria-label="Document title"
          value={title}
          maxLength={200}
          onChange={(e) => {
            setTitle(e.target.value);
            titleRef.current = e.target.value;
            changed();
          }}
        />
      ) : (
        <h2 className="document-title-readonly">{doc.title}</h2>
      )}
      {editable && (
        <div
          className="editor-toolbar"
          role="toolbar"
          aria-label="Document formatting"
        >
          {tool(
            "Bold",
            <Bold size={15} />,
            () => editor.chain().focus().toggleBold().run(),
            editor.isActive("bold"),
          )}
          {tool(
            "Italic",
            <Italic size={15} />,
            () => editor.chain().focus().toggleItalic().run(),
            editor.isActive("italic"),
          )}
          {tool(
            "Heading",
            <Heading2 size={17} />,
            () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
            editor.isActive("heading"),
          )}
          {tool("Bullet list", <List size={16} />, () =>
            editor.chain().focus().toggleBulletList().run(),
          )}
          {tool("Numbered list", <ListOrdered size={16} />, () =>
            editor.chain().focus().toggleOrderedList().run(),
          )}
          {tool("Checklist", <CheckSquare size={15} />, () =>
            editor.chain().focus().toggleTaskList().run(),
          )}
          {tool("Insert table", <Table2 size={15} />, () =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run(),
          )}
          {tool("Add link", <Link2 size={15} />, () =>
            setLinkDialog(!linkDialog),
          )}
          {tool("Undo", <Undo size={15} />, () =>
            editor.chain().focus().undo().run(),
          )}
          {tool("Redo", <Redo size={15} />, () =>
            editor.chain().focus().redo().run(),
          )}
          <label className="editor-tool" title="Insert an image">
            <ImagePlus size={16} />
            <input
              aria-label="Insert image"
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={(e) => {
                void uploadIntoEditor(Array.from(e.target.files || []));
                e.target.value = "";
              }}
            />
          </label>
          <button
            className="button"
            onClick={async () => {
              const { from, to } = editor.state.selection;
              const selection = editor.state.doc
                .textBetween(from, to, " ")
                .trim();
              const title =
                selection ||
                editor.state.doc.resolve(from).parent.textContent.trim();
              if (!title) {
                setError("Select a line of text to turn into a task.");
                return;
              }
              if (!(await save())) return;
              try {
                const t = await request<Task>(
                  "documents/" + doc.id + "/tasks",
                  "POST",
                  { title: title.slice(0, 200) },
                );
                await reload();
                message("Task created and linked to this document.");
                onTask(t.id);
              } catch (e) {
                setError(errorText(e));
              }
            }}
          >
            Selection → task
          </button>
        </div>
      )}
      {linkDialog && (
        <form
          className="inline-feature-form link-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!/^(https?:\/\/|mailto:)/i.test(linkInput)) {
              setError("Use an HTTP, HTTPS or email link.");
              return;
            }
            editor
              .chain()
              .focus()
              .extendMarkRange("link")
              .setLink({ href: linkInput })
              .run();
            setLinkDialog(false);
            setLinkInput("");
          }}
        >
          <input
            aria-label="Link URL"
            value={linkInput}
            placeholder="https://…"
            required
            onChange={(e) => setLinkInput(e.target.value)}
          />
          <button className="button">Apply link</button>
          <button
            type="button"
            className="button"
            onClick={() => {
              editor.chain().focus().unsetLink().run();
              setLinkDialog(false);
            }}
          >
            Remove link
          </button>
        </form>
      )}
      {editor.isActive("table") && editable && (
        <div className="table-tools">
          <button onClick={() => editor.chain().focus().addRowAfter().run()}>
            Add row
          </button>
          <button onClick={() => editor.chain().focus().addColumnAfter().run()}>
            Add column
          </button>
          <button onClick={() => editor.chain().focus().deleteRow().run()}>
            Delete row
          </button>
          <button onClick={() => editor.chain().focus().deleteColumn().run()}>
            Delete column
          </button>
          <button onClick={() => editor.chain().focus().deleteTable().run()}>
            Remove table
          </button>
        </div>
      )}
      {error && (
        <div className="document-error" role="alert">
          <p>{error}</p>
          <div>
            <button
              className="button"
              onClick={() => {
                const blob = new Blob([JSON.stringify(draft(), null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = doc.id + "-draft.json";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              Download draft
            </button>
            <button
              className="button"
              onClick={() => {
                dirty.current = false;
                localStorage.removeItem(key);
                version.current = doc.version;
                titleRef.current = doc.title;
                setTitle(doc.title);
                editor.commands.setContent(doc.body, { emitUpdate: false });
                setError("");
                setStatus("Saved");
              }}
            >
              Load latest saved version
            </button>
            <button className="button" onClick={() => void save()}>
              Retry save
            </button>
          </div>
        </div>
      )}
      <EditorContent
        editor={editor}
        onDragOver={(event) => {
          if (editable && event.dataTransfer.types.includes("Files"))
            event.preventDefault();
        }}
        onDropCapture={(event) => {
          if (editable && event.dataTransfer.files.length) {
            event.preventDefault();
            event.stopPropagation();
            void uploadIntoEditor(Array.from(event.dataTransfer.files));
          }
        }}
      />
      {editable && (
        <p className="feature-hint editor-tip">
          Drop or paste images into the document. Select a line, then choose
          “Selection → task”.
        </p>
      )}
      <FilePanel
        data={data}
        reload={reload}
        message={message}
        documentId={doc.id}
        editable={editable}
        onImage={insertUploadedImage}
      />
    </section>
  );
}
export function DocumentsView({
  data,
  reload,
  message,
  projectId,
  activeId,
  onActive,
  onTask,
}: Shared & {
  projectId: string;
  activeId: string | null;
  onActive: (id: string) => void;
  onTask: (id: string) => void;
}) {
  const [filter, setFilter] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [history, setHistory] = useState<DocumentRevision[] | null>(null),
    [preview, setPreview] = useState<DocumentRevision | null>(null),
    [generation, setGeneration] = useState(0),
    [linkTask, setLinkTask] = useState("");
  const handle = useRef<EditorHandle | null>(null);
  const project = data.projects.find((p) => p.id === projectId),
    editable = !!project && ["Edit", "Manage"].includes(project.access),
    documents = data.documents.filter((d) => d.projectId === projectId),
    doc = documents.find((d) => d.id === activeId) || documents[0];
  async function choose(id: string) {
    if ((await handle.current?.flush()) === false) return;
    setHistory(null);
    setPreview(null);
    setError("");
    onActive(id);
  }
  return (
    <div className="documents-workspace">
      <aside className="document-list">
        <div className="document-list-title">
          <h2>
            <FileText size={17} />
            Documents
          </h2>
          {editable && (
            <button
              className="icon-button"
              aria-label="Create document"
              disabled={busy}
              onClick={async () => {
                if ((await handle.current?.flush()) === false) return;
                setBusy(true);
                try {
                  const d = await request<ProjectDocument>(
                    "documents",
                    "POST",
                    { projectId, title: "Untitled document" },
                  );
                  await reload();
                  onActive(d.id);
                } catch (e) {
                  setError(errorText(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Plus size={18} />
            </button>
          )}
        </div>
        <input
          aria-label="Filter project documents"
          placeholder="Find a document…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {documents
          .filter((d) =>
            (d.title + " " + textOf(d.body))
              .toLowerCase()
              .includes(filter.toLowerCase()),
          )
          .map((d) => (
            <button
              key={d.id}
              className={doc?.id === d.id ? "active" : ""}
              onClick={() => void choose(d.id)}
            >
              <FileText size={15} />
              <span>
                <strong>{d.title}</strong>
                <small>{new Date(d.updatedAt).toLocaleDateString()}</small>
              </span>
            </button>
          ))}
        {!documents.length && (
          <p className="feature-hint">A home for briefs, notes and ideas.</p>
        )}
      </aside>
      <div className="document-main">
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {doc ? (
          <>
            <DocumentEditor
              key={data.user.id + "-" + doc.id + "-" + generation}
              doc={doc}
              data={data}
              reload={reload}
              message={message}
              editable={editable}
              handle={handle}
              onTask={onTask}
              onHistory={async () => {
                try {
                  setHistory(
                    (
                      await request<{ revisions: DocumentRevision[] }>(
                        "documents/" + doc.id + "/history",
                      )
                    ).revisions,
                  );
                } catch (e) {
                  setError(errorText(e));
                }
              }}
            />
            <section className="feature-section document-task-links">
              <h3>
                <Link2 size={15} />
                Linked tasks
              </h3>
              {data.documentLinks
                .filter((l) => l.documentId === doc.id)
                .map((l) => {
                  const t = data.tasks.find(
                    (t) => t.id === l.taskId && !t.deletedAt,
                  );
                  return (
                    t && (
                      <button
                        className="related-row"
                        key={t.id}
                        onClick={() => onTask(t.id)}
                      >
                        <span>{t.id}</span>
                        <strong>{t.title}</strong>
                        <ArrowUpRight size={14} />
                      </button>
                    )
                  );
                })}
              {editable && (
                <form
                  className="inline-feature-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await request("documents/" + doc.id + "/links", "POST", {
                        taskId: linkTask,
                      });
                      setLinkTask("");
                      await reload();
                    } catch (e) {
                      setError(errorText(e));
                    }
                  }}
                >
                  <select
                    aria-label="Task to link"
                    value={linkTask}
                    required
                    onChange={(e) => setLinkTask(e.target.value)}
                  >
                    <option value="">Link an existing project task…</option>
                    {data.tasks
                      .filter(
                        (t) =>
                          t.projectId === projectId &&
                          !t.deletedAt &&
                          !t.archived &&
                          !data.documentLinks.some(
                            (l) => l.documentId === doc.id && l.taskId === t.id,
                          ),
                      )
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.id} · {t.title}
                        </option>
                      ))}
                  </select>
                  <button className="button" disabled={!linkTask}>
                    <Link2 size={13} />
                    Link task
                  </button>
                </form>
              )}
            </section>
            {history && (
              <section
                className="document-history"
                aria-label="Document history"
              >
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="feature-section-title">
                  <h3>
                    <History size={17} />
                    Saved versions
                  </h3>
                  <button
                    className="icon-button"
                    aria-label="Close history"
                    onClick={() => {
                      setHistory(null);
                      setPreview(null);
                    }}
                  >
                    <X size={17} />
                  </button>
                </div>
                <p className="feature-hint">
                  Restoring creates a new version. Up to 30 previous saves are
                  kept.
                </p>
                {history.length ? (
                  history.map((r) => (
                    <div className="revision-row" key={r.id}>
                      <div>
                        <strong>
                          Version {r.version} · {r.title}
                        </strong>
                        <small>
                          {when(r.savedAt)} ·{" "}
                          {data.people.find((p) => p.id === r.savedBy)?.name ||
                            "Teammate"}
                        </small>
                      </div>
                      <button className="button" onClick={() => setPreview(r)}>
                        Preview
                      </button>
                      {editable && (
                        <button
                          className="button"
                          disabled={busy}
                          onClick={async () => {
                            if ((await handle.current?.flush()) === false)
                              return;
                            setBusy(true);
                            try {
                              await request(
                                "documents/" + doc.id + "/restore",
                                "POST",
                                { revisionId: r.id, version: doc.version },
                              );
                              await reload();
                              setHistory(null);
                              setPreview(null);
                              setGeneration((v) => v + 1);
                              message("Document restored as a new version.");
                            } catch (e) {
                              setError(errorText(e));
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          <RotateCcw size={12} />
                          Restore
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="feature-hint">
                    Previous versions will appear after the next edit.
                  </p>
                )}
                {preview && (
                  <div className="revision-preview">
                    <h4>
                      {preview.title} · Version {preview.version}
                    </h4>
                    <p>{textOf(preview.body) || "Empty document"}</p>
                  </div>
                )}
              </section>
            )}
          </>
        ) : (
          <div className="empty-state">
            <FileText size={31} />
            <h3>A little context goes a long way</h3>
            <p>
              Create a document for briefs, meeting notes, images and project
              plans.
            </p>
            {editable && (
              <button
                className="button primary"
                onClick={async () => {
                  try {
                    const d = await request<ProjectDocument>(
                      "documents",
                      "POST",
                      { projectId, title: "Untitled document" },
                    );
                    await reload();
                    onActive(d.id);
                  } catch (e) {
                    setError(errorText(e));
                  }
                }}
              >
                <Plus size={15} />
                Create your first document
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
export function UniversalSearch({
  data,
  workspace,
  onTask,
  onDocument,
}: {
  data: FeatureData;
  workspace: string;
  onTask: (id: string) => void;
  onDocument: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase(),
    projectIds = new Set(
      data.projects.filter((p) => p.workspaceId === workspace).map((p) => p.id),
    );
  const tasks = q
    ? data.tasks
        .filter(
          (t) =>
            !t.archived &&
            !t.deletedAt &&
            projectIds.has(t.projectId) &&
            `${t.id} ${t.title} ${t.description}`.toLowerCase().includes(q),
        )
        .sort(
          (a, b) =>
            Number(b.id.toLowerCase() === q) - Number(a.id.toLowerCase() === q),
        )
        .slice(0, 30)
    : [];
  const documents = q
    ? data.documents
        .filter(
          (d) =>
            projectIds.has(d.projectId) &&
            `${d.id} ${d.title} ${textOf(d.body)}`.toLowerCase().includes(q),
        )
        .slice(0, 20)
    : [];
  const files = q
    ? data.attachments
        .filter(
          (f) =>
            projectIds.has(f.projectId) && f.name.toLowerCase().includes(q),
        )
        .slice(0, 20)
    : [];
  return (
    <>
      <div className="global-search">
        <Search size={20} />
        <input
          aria-label="Search all work"
          autoFocus
          placeholder="Search tasks, documents and files…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <kbd>ESC</kbd>
      </div>
      <div className="search-results universal-results">
        {!q ? (
          <div className="empty-state">
            <Search size={25} />
            <h3>Everything, in one place</h3>
            <p>Search task IDs, document text or file names.</p>
          </div>
        ) : (
          <>
            {!!tasks.length && <h3>Tasks · {tasks.length}</h3>}
            {tasks.map((t) => (
              <button key={t.id} onClick={() => onTask(t.id)}>
                <CheckSquare size={17} />
                <span>
                  <strong>{t.title}</strong>
                  <small>
                    {t.id} ·{" "}
                    {data.projects.find((p) => p.id === t.projectId)?.name}
                  </small>
                </span>
                <ArrowUpRight size={14} />
              </button>
            ))}
            {!!documents.length && <h3>Documents · {documents.length}</h3>}
            {documents.map((d) => (
              <button key={d.id} onClick={() => onDocument(d.id)}>
                <FileText size={17} />
                <span>
                  <strong>{d.title}</strong>
                  <small>
                    {d.id} · {textOf(d.body).slice(0, 110)}
                  </small>
                </span>
                <ArrowUpRight size={14} />
              </button>
            ))}
            {!!files.length && <h3>Files · {files.length}</h3>}
            {files.map((f) => (
              <a
                className="search-file-result"
                key={f.id}
                href={"/api/files/" + f.id + "?download=1"}
              >
                <Paperclip size={17} />
                <span>
                  <strong>{f.name}</strong>
                  <small>
                    {data.projects.find((p) => p.id === f.projectId)?.name} ·{" "}
                    {Math.max(1, Math.round(f.size / 1024))} KB
                  </small>
                </span>
                <Download size={14} />
              </a>
            ))}
            {!tasks.length && !documents.length && !files.length && (
              <div className="empty-state">
                <h3>No matches this time</h3>
                <p>Try another keyword, title or file name.</p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
