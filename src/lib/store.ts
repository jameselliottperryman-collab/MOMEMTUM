import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { State, Task } from "./model";
const dir = process.env.RELAYWORK_DATA_DIR || join(process.cwd(), ".data");
mkdirSync(dir, { recursive: true });
const db = new DatabaseSync(join(dir, "relaywork.sqlite"));
db.exec(
  "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS app (id INTEGER PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL);",
);
function seed(): State {
  const now = new Date();
  const day = (offset: number) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  const people: State["people"] = [
    {
      id: "alex",
      name: "Alex Morgan",
      email: "alex@example.test",
      initials: "AM",
      color: "#e5d9fc",
      role: "Owner",
    },
    {
      id: "nina",
      name: "Nina Patel",
      email: "nina@example.test",
      initials: "NP",
      color: "#f7d7ca",
      role: "Member",
    },
    {
      id: "leo",
      name: "Leo Chen",
      email: "leo@example.test",
      initials: "LC",
      color: "#d4e8dc",
      role: "Member",
    },
    {
      id: "jordan",
      name: "Jordan Lee",
      email: "jordan@example.test",
      initials: "JL",
      color: "#d7e5f9",
      role: "Guest",
    },
  ];
  const definitions: [
    string,
    string,
    Task["status"],
    Task["priority"],
    string[],
    number,
    string[],
  ][] = [
    [
      "Brand guidelines & visual direction",
      "A clear creative foundation for the next chapter. Explore typography, color, and art direction.",
      "In progress",
      "High",
      ["alex", "nina"],
      2,
      ["Design"],
    ],
    [
      "Homepage wireframes",
      "Map the story from the opening headline to the final call to action. Include mobile layouts.",
      "In progress",
      "High",
      ["nina"],
      3,
      ["Design", "Website"],
    ],
    [
      "Gather customer testimonials",
      "Collect approved quotes and headshots from three customers.",
      "To do",
      "Normal",
      ["leo"],
      5,
      ["Content"],
    ],
    [
      "Write launch announcement",
      "Draft the launch story for our community and customers.",
      "To do",
      "Normal",
      ["alex"],
      7,
      ["Content"],
    ],
    [
      "Competitor landscape",
      "Review positioning and identify opportunities to stand apart.",
      "Done",
      "Normal",
      ["leo"],
      -2,
      ["Research"],
    ],
    [
      "Landing page copy",
      "A concise story about what we do, who we help, and why it matters. Ready for a fresh pair of eyes.",
      "In review",
      "High",
      ["alex"],
      1,
      ["Content", "Website"],
    ],
    [
      "Social media launch kit",
      "Create launch-day assets for LinkedIn and Instagram.",
      "To do",
      "Low",
      ["nina"],
      9,
      ["Design"],
    ],
    [
      "Review mobile navigation",
      "Validate the navigation flow on small screens and share feedback.",
      "In review",
      "Normal",
      ["leo"],
      0,
      ["Website"],
    ],
    [
      "Set up analytics events",
      "Define the conversion events and test the measurement plan.",
      "To do",
      "High",
      ["leo"],
      4,
      ["Website"],
    ],
    [
      "Moodboard exploration",
      "Explore the visual world: warm, purposeful, and a little unexpected.",
      "Done",
      "Normal",
      ["nina"],
      -3,
      ["Design"],
    ],
    [
      "Build the component library",
      "Create reusable interface patterns with accessible states.",
      "In progress",
      "Normal",
      ["nina", "leo"],
      6,
      ["Design", "Website"],
    ],
    [
      "Stakeholder kickoff",
      "Align on the goals, audience, and launch milestones.",
      "Done",
      "High",
      ["alex"],
      -5,
      ["Planning"],
    ],
  ];
  const tasks: Task[] = definitions.map((d, i) => ({
    id: `RW-${101 + i}`,
    projectId: "brand",
    title: d[0],
    description: d[1],
    status: d[2],
    priority: d[3],
    assignees: d[4],
    due: day(d[5]),
    tags: d[6],
    checklist:
      i === 0
        ? [
            { id: "c1", text: "Explore visual directions", done: true },
            { id: "c2", text: "Refine typography & colors", done: false },
            { id: "c3", text: "Present to the team", done: false },
          ]
        : [],
    version: 1,
    archived: false,
    createdAt: now.toISOString(),
  }));
  tasks.push({
    ...tasks[0],
    id: "RW-113",
    projectId: "website",
    title: "Audit the current website",
    status: "To do",
    checklist: [],
    tags: ["Research"],
  });
  tasks.push({
    ...tasks[0],
    id: "RW-114",
    projectId: "internal",
    title: "Quarterly studio planning",
    status: "To do",
    assignees: ["alex"],
    checklist: [],
    tags: ["Planning"],
  });
  return {
    people,
    workspaces: [
      {
        id: "studio",
        name: "Forma Studio",
        initials: "FS",
        members: people.map((p) => p.id),
      },
    ],
    projects: [
      {
        id: "brand",
        workspaceId: "studio",
        name: "Brand launch",
        description:
          "A fresh identity. A thoughtful launch. Let’s make our next chapter count.",
        color: "#8772ce",
        icon: "spark",
        restricted: true,
        grants: {
          alex: "Manage",
          nina: "Edit",
          leo: "Edit",
          jordan: "Comment",
        },
      },
      {
        id: "website",
        workspaceId: "studio",
        name: "Website refresh",
        description: "A better home for our work and our story.",
        color: "#5d9c8f",
        icon: "globe",
        restricted: false,
        grants: { alex: "Manage" },
      },
      {
        id: "internal",
        workspaceId: "studio",
        name: "Studio operations",
        description: "The little things that keep the studio moving.",
        color: "#d69c65",
        icon: "folder",
        restricted: true,
        grants: { alex: "Manage" },
      },
    ],
    tasks,
    comments: [
      {
        id: randomUUID(),
        taskId: "RW-101",
        authorId: "nina",
        body: "The first direction is ready! I’ve brought in warmer tones and a more editorial feel. Would love your thoughts.",
        createdAt: now.toISOString(),
      },
      {
        id: randomUUID(),
        taskId: "RW-106",
        authorId: "jordan",
        body: "Love the direction. Could we make the opening line a little more specific to our audience?",
        createdAt: now.toISOString(),
      },
    ],
    activity: [],
    notices: [
      {
        id: randomUUID(),
        userId: "alex",
        taskId: "RW-106",
        text: "Jordan Lee left feedback on Landing page copy",
        read: false,
        createdAt: now.toISOString(),
      },
      {
        id: randomUUID(),
        userId: "alex",
        taskId: "RW-101",
        text: "Nina Patel commented on Brand guidelines & visual direction",
        read: false,
        createdAt: now.toISOString(),
      },
    ],
    nextTask: 115,
  };
}
if (!db.prepare("SELECT id FROM app WHERE id = 1").get())
  db.prepare("INSERT INTO app VALUES (1, ?)").run(JSON.stringify(seed()));
export function readState(): State {
  return JSON.parse(
    (db.prepare("SELECT data FROM app WHERE id = 1").get() as { data: string })
      .data,
  );
}
export function mutate<T>(fn: (state: State) => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const s = readState();
    const result = fn(s);
    db.prepare("UPDATE app SET data = ? WHERE id = 1").run(JSON.stringify(s));
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export function sessionUser(token: string) {
  const row = db
    .prepare("SELECT user_id FROM sessions WHERE token = ? AND expires > ?")
    .get(token, Date.now()) as { user_id: string } | undefined;
  return row?.user_id;
}
export function newSession(user: string) {
  const token = randomUUID();
  db.prepare("DELETE FROM sessions WHERE expires < ?").run(Date.now());
  db.prepare("INSERT INTO sessions VALUES (?, ?, ?)").run(
    token,
    user,
    Date.now() + 86400000,
  );
  return token;
}
