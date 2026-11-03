import { test } from "node:test";
import assert from "node:assert/strict";
import {
  can,
  grantFor,
  visibleState,
  parseCSV,
  csvCell,
} from "../src/lib/model.ts";
import type { State, Project } from "../src/lib/model.ts";
const restricted: Project = {
  id: "secret",
  workspaceId: "w",
  name: "Private",
  description: "",
  color: "",
  icon: "",
  restricted: true,
  grants: { member: "Edit", guest: "Comment" },
};
function fixture(): State {
  return {
    people: [
      {
        id: "owner",
        name: "Owner",
        email: "",
        initials: "",
        color: "",
        role: "Owner",
      },
      {
        id: "member",
        name: "Member",
        email: "",
        initials: "",
        color: "",
        role: "Member",
      },
      {
        id: "guest",
        name: "Guest",
        email: "",
        initials: "",
        color: "",
        role: "Guest",
      },
    ],
    workspaces: [
      {
        id: "w",
        name: "Workspace",
        initials: "",
        members: ["owner", "member", "guest"],
      },
    ],
    projects: [
      structuredClone(restricted),
      { ...restricted, id: "public", restricted: false, grants: {} },
    ],
    tasks: [
      {
        id: "T1",
        projectId: "secret",
        title: "Hidden",
        description: "",
        status: "To do",
        priority: "Normal",
        assignees: ["guest"],
        due: "",
        tags: [],
        checklist: [],
        version: 1,
        archived: false,
        createdAt: "",
      },
    ],
    comments: [
      {
        id: "c",
        taskId: "T1",
        authorId: "member",
        body: "Secret comment",
        createdAt: "",
      },
    ],
    activity: [
      {
        id: "a",
        taskId: "T1",
        actorId: "member",
        text: "Secret update",
        createdAt: "",
      },
    ],
    notices: [
      {
        id: "n",
        taskId: "T1",
        userId: "guest",
        text: "Secret notification",
        read: false,
        createdAt: "",
      },
    ],
    nextTask: 2,
  };
}
test("workspace owner has no implicit restricted content access", () => {
  const s = fixture();
  assert.equal(grantFor(s, "owner", s.projects[0]), null);
  assert.equal(can(s, "owner", s.projects[1], "Edit"), true);
});
test("guest can comment but cannot edit or discover workspace-visible projects", () => {
  const s = fixture();
  assert.equal(can(s, "guest", s.projects[0], "Comment"), true);
  assert.equal(can(s, "guest", s.projects[0], "Edit"), false);
  assert.equal(grantFor(s, "guest", s.projects[1]), null);
});
test("revocation removes task, comment, activity, inbox and project metadata together", () => {
  const s = fixture();
  assert.equal(visibleState(s, "guest").tasks.length, 1);
  delete s.projects[0].grants.guest;
  const v = visibleState(s, "guest");
  for (const key of [
    "projects",
    "tasks",
    "comments",
    "activity",
    "notices",
  ] as const)
    assert.equal(v[key].length, 0, key);
  assert.deepEqual(
    v.people.map((p) => p.id),
    ["guest"],
  );
});
test("an assignment is not an access grant", () => {
  const s = fixture();
  delete s.projects[0].grants.guest;
  assert.equal(visibleState(s, "guest").tasks.length, 0);
});
test("removed workspace membership overrides existing grants", () => {
  const s = fixture();
  s.workspaces[0].members = ["owner", "member"];
  assert.equal(grantFor(s, "guest", s.projects[0]), null);
});
test("CSV preserves commas, multiline cells, quotes and BOM", () => {
  assert.deepEqual(
    parseCSV('\uFEFFTitle,Description\r\n"A, B","Line 1\nLine ""2"""\r\n'),
    [
      ["Title", "Description"],
      ["A, B", 'Line 1\nLine "2"'],
    ],
  );
});
test("CSV rejects unterminated quoted cells", () => {
  assert.throws(() => parseCSV('Title\n"unfinished'));
});
test("CSV export escapes formula injection and quotes", () => {
  assert.equal(csvCell("=SUM(1,2)"), `"'=SUM(1,2)"`);
  assert.equal(csvCell('A "quote"'), '"A ""quote"""');
});

test("CSV rejects characters after a closing quote", () => {
  assert.throws(() => parseCSV('Title\n"hello"world'));
});
