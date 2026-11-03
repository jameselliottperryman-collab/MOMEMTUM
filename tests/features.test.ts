import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeState,
  deliverReminders,
  validateDocument,
  textOf,
} from "../src/lib/features.ts";
import type { State, Task } from "../src/lib/model.ts";
import { visibleState } from "../src/lib/model.ts";
function fixture(): State {
  return normalizeState({
    people: [
      {
        id: "a",
        name: "A",
        email: "",
        initials: "A",
        color: "",
        role: "Owner",
      },
      {
        id: "g",
        name: "Guest",
        email: "",
        initials: "G",
        color: "",
        role: "Guest",
      },
    ],
    workspaces: [{ id: "w", name: "W", initials: "W", members: ["a", "g"] }],
    projects: [
      {
        id: "p",
        workspaceId: "w",
        name: "P",
        description: "",
        color: "",
        icon: "",
        restricted: true,
        grants: { a: "Manage", g: "Comment" },
      },
    ],
    tasks: [
      {
        id: "T1",
        projectId: "p",
        title: "Review",
        description: "",
        status: "To do",
        priority: "Normal",
        assignees: ["a"],
        due: "",
        tags: [],
        checklist: [],
        version: 1,
        archived: false,
        createdAt: "",
      },
    ],
    comments: [],
    activity: [],
    notices: [],
    nextTask: 2,
  });
}
test("old state is extended without changing existing tasks or comments", () => {
  const s = fixture();
  assert.equal(s.tasks[0].title, "Review");
  assert.equal(s.schemaVersion, 2);
  assert.deepEqual(s.documents, []);
  assert.deepEqual(s.reminders, []);
});
test("document validation strips unknown attributes and preserves supported text", () => {
  const d = validateDocument(
    {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2, onclick: "bad" },
          content: [{ type: "text", text: "Brief", marks: [{ type: "bold" }] }],
        },
      ],
    },
    () => false,
  );
  assert.equal(textOf(d), "Brief");
  assert.deepEqual(d.content?.[0].attrs, { level: 2 });
});
test("document validation rejects executable links and foreign image references", () => {
  assert.throws(() =>
    validateDocument(
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "unsafe",
                marks: [
                  { type: "link", attrs: { href: "javascript:alert(1)" } },
                ],
              },
            ],
          },
        ],
      },
      () => true,
    ),
  );
  assert.throws(() =>
    validateDocument(
      {
        type: "doc",
        content: [
          {
            type: "image",
            attrs: { src: "/api/files/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" },
          },
        ],
      },
      () => false,
    ),
  );
  assert.throws(() =>
    validateDocument(
      {
        type: "doc",
        content: [
          { type: "image", attrs: { src: "https://example.com/tracker.png" } },
        ],
      },
      () => true,
    ),
  );
});
test("reminders deliver exactly once and recheck access at delivery", () => {
  const s = fixture(),
    now = Date.now();
  s.reminders = [
    {
      id: "r",
      userId: "g",
      taskId: "T1",
      dueAt: new Date(now - 1).toISOString(),
      note: "Look again",
    },
  ];
  deliverReminders(s, now);
  deliverReminders(s, now + 100);
  assert.equal(s.notices.length, 1);
  assert.equal(s.notices[0].userId, "g");
  assert.ok(s.reminders[0].deliveredAt);
  const blocked = fixture();
  blocked.reminders = [
    {
      id: "r",
      userId: "g",
      taskId: "T1",
      dueAt: new Date(now - 1).toISOString(),
      note: "",
    },
  ];
  delete blocked.projects[0].grants.g;
  deliverReminders(blocked, now);
  assert.equal(blocked.notices.length, 0);
});
test("trash is hidden from reviewers and file metadata follows active targets", () => {
  const s = fixture();
  s.tasks[0].deletedAt = new Date().toISOString();
  s.attachments = [
    {
      id: "f",
      projectId: "p",
      taskId: "T1",
      name: "private.pdf",
      mime: "application/pdf",
      size: 12,
      createdAt: "",
      uploadedBy: "a",
    },
  ];
  s.reminders = [
    {
      id: "r",
      userId: "g",
      taskId: "T1",
      dueAt: new Date(0).toISOString(),
      note: "",
    },
  ];
  assert.equal(visibleState(s, "g").tasks.length, 0);
  assert.equal(visibleState(s, "g").attachments.length, 0);
  assert.equal(visibleState(s, "a").tasks.length, 1);
  deliverReminders(s);
  assert.equal(s.notices.length, 0);
});
test("project revocation also hides documents and their attachments and links", () => {
  const s = fixture();
  s.documents = [
    {
      id: "D1",
      projectId: "p",
      title: "Brief",
      body: { type: "doc" },
      version: 1,
      createdAt: "",
      updatedAt: "",
      updatedBy: "a",
    },
  ];
  s.attachments = [
    {
      id: "f",
      projectId: "p",
      documentId: "D1",
      name: "brief.pdf",
      mime: "application/pdf",
      size: 12,
      createdAt: "",
      uploadedBy: "a",
    },
  ];
  s.documentLinks = [{ documentId: "D1", taskId: "T1" }];
  assert.equal(visibleState(s, "g").documents.length, 1);
  delete s.projects[0].grants.g;
  const v = visibleState(s, "g");
  assert.equal(v.documents.length, 0);
  assert.equal(v.attachments.length, 0);
  assert.equal(v.documentLinks.length, 0);
});

test("document search includes readable image captions", () => {
  assert.equal(
    textOf({
      type: "doc",
      content: [{ type: "image", attrs: { caption: "Launch illustration" } }],
    }),
    "Launch illustration",
  );
});
