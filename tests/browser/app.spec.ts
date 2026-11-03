import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("project board, task creation, comments, checklist, views and persistence", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Brand launch", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".task-card")).toHaveCount(12);
  await page.screenshot({ path: "/tmp/relaywork-desktop.png", fullPage: true });
  await page
    .getByRole("button", { name: "Add task", exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "Task name" })
    .fill("Prepare pilot review");
  await page
    .getByLabel("Description", { exact: true })
    .fill("A real task created by the browser test.");
  await page.getByLabel("Assignee", { exact: true }).selectOption("alex");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  const detail = page.getByRole("dialog", { name: /Task RW-/ });
  await expect(detail).toBeVisible();
  await detail
    .getByLabel("Task status", { exact: true })
    .selectOption("In review");
  await expect(detail.getByLabel("Task status", { exact: true })).toHaveValue(
    "In review",
  );
  await expect(
    detail.getByLabel("Task priority", { exact: true }),
  ).toBeEnabled();
  await detail.getByLabel("New checklist item").fill("Check the deliverable");
  await detail.getByRole("button", { name: "Add", exact: true }).click();
  await expect(
    detail.getByLabel("Check the deliverable", { exact: true }),
  ).toBeVisible();
  await detail.getByLabel("Check the deliverable", { exact: true }).check();
  await detail.getByLabel("Write a comment").fill("Ready for your feedback.");
  await detail.getByRole("button", { name: "Post comment" }).click();
  await expect(
    detail.getByText("Ready for your feedback.", { exact: true }),
  ).toBeVisible();
  await detail.getByRole("button", { name: "Close task" }).click();
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(
    page
      .getByRole("table")
      .getByRole("button", { name: /Prepare pilot review/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save view", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(
    page
      .getByRole("table")
      .getByRole("button", { name: /Prepare pilot review/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Search anything" }).click();
  await page
    .getByPlaceholder("Search by task name, ID, or keyword...")
    .fill("Prepare pilot");
  await expect(
    page.locator(".search-results").getByText("Prepare pilot review"),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});
test("guest permissions, version conflict, transactional CSV and revocation via real API", async ({
  playwright,
}) => {
  const owner = await playwright.request.newContext({
    baseURL: "http://localhost:3001",
    extraHTTPHeaders: { Origin: "http://localhost:3001" },
  });
  const guest = await playwright.request.newContext({
    baseURL: "http://localhost:3001",
    extraHTTPHeaders: { Origin: "http://localhost:3001" },
  });
  await owner.get("/api/state");
  await guest.post("/api/session", { data: { userId: "jordan" } });
  const before = await (await guest.get("/api/state")).json();
  expect(before.projects.map((p: { id: string }) => p.id)).toEqual(["brand"]);
  expect(
    before.tasks.some((t: { projectId: string }) => t.projectId === "internal"),
  ).toBe(false);
  let r = await guest.patch("/api/tasks/RW-101", {
    data: { version: 1, title: "Forbidden edit" },
  });
  expect(r.status()).toBe(403);
  r = await guest.get("/api/export/brand");
  expect(r.status()).toBe(403);
  r = await guest.post("/api/tasks/RW-101/comments", {
    data: { body: "Guest review via API" },
  });
  expect(r.ok()).toBe(true);
  const state = await (await owner.get("/api/state")).json();
  const t = state.tasks.find((t: { id: string }) => t.id === "RW-101");
  r = await owner.patch("/api/tasks/RW-101", {
    data: { version: t.version, priority: "Urgent" },
  });
  expect(r.ok()).toBe(true);
  r = await owner.patch("/api/tasks/RW-101", {
    data: { version: t.version, title: "Stale title" },
  });
  expect(r.status()).toBe(412);
  r = await owner.post("/api/import", {
    data: {
      projectId: "brand",
      csv: "Title,Status\nValid,To do\nInvalid,Imaginary",
      commit: true,
      operationId: "test-import",
    },
  });
  expect(r.status()).toBe(422);
  let after = await (await owner.get("/api/state")).json();
  expect(after.tasks.length).toBe(state.tasks.length);
  r = await owner.post("/api/import", {
    data: {
      projectId: "brand",
      csv: "Title,Status\nCSV task,To do",
      commit: false,
    },
  });
  expect((await r.json()).preview).toHaveLength(1);
  after = await (await owner.get("/api/state")).json();
  expect(after.tasks.length).toBe(state.tasks.length);
  r = await owner.post("/api/import", {
    data: {
      projectId: "brand",
      csv: "Title,Status\nCSV task,To do",
      commit: true,
      operationId: "test-import",
    },
  });
  expect((await r.json()).count).toBe(1);
  r = await owner.post("/api/import", {
    data: {
      projectId: "brand",
      csv: "Title,Status\nCSV task,To do",
      commit: true,
      operationId: "test-import",
    },
  });
  expect((await r.json()).count).toBe(1);
  after = await (await owner.get("/api/state")).json();
  expect(after.tasks.length).toBe(state.tasks.length + 1);
  r = await owner.post("/api/projects/brand/grants", {
    data: { userId: "jordan", grant: null },
  });
  expect(r.ok()).toBe(true);
  const revoked = await (await guest.get("/api/state")).json();
  expect(revoked.projects).toEqual([]);
  expect(revoked.tasks).toEqual([]);
  expect(revoked.comments).toEqual([]);
  expect(revoked.notices).toEqual([]);
  r = await guest.post("/api/tasks/RW-101/comments", {
    data: { body: "After revocation" },
  });
  expect(r.status()).toBe(404);
  r = await guest.get("/api/export/brand");
  expect(r.status()).toBe(404);
  await owner.post("/api/projects/brand/grants", {
    data: { userId: "jordan", grant: "Comment" },
  });
  r = await owner.post("/api/workspaces", {
    data: { name: "Isolated workspace" },
  });
  const ws = await r.json();
  expect(r.ok()).toBe(true);
  r = await guest.post("/api/tasks", {
    data: { projectId: ws.projectId, title: "Cross workspace" },
  });
  expect(r.status()).toBe(404);
  r = await owner.post("/api/tasks", {
    data: {
      projectId: ws.projectId,
      title: "Private workspace task",
      assignees: ["nina"],
    },
  });
  expect(r.status()).toBe(422);
  await owner.dispose();
  await guest.dispose();
});
test("phone navigation and task review remain usable without page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Brand launch", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "My work", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "My work", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Brand launch", exact: true }).click();
  await page.locator(".card-title").first().click();
  await expect(page.getByRole("dialog", { name: /Task RW-/ })).toBeVisible();
  await page.screenshot({
    path: "/tmp/relaywork-mobile-task.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close task" }).click();
  await page.screenshot({ path: "/tmp/relaywork-mobile.png", fullPage: true });
});

test("automated accessibility checks on board and task dialog", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Brand launch", exact: true }),
  ).toBeVisible();
  let results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
  await page.locator(".card-title").first().click();
  await expect(page.getByRole("dialog", { name: /Task RW-/ })).toBeVisible();
  results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
});

test("account switching stays reachable on short desktop screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Brand launch", exact: true }),
  ).toBeVisible();
  const account = page.locator(".account-button");
  await account.scrollIntoViewIfNeeded();
  await expect(account).toBeInViewport();
  await account.click();
  await expect(
    page
      .locator(".account-popover")
      .getByRole("button", { name: /Jordan Lee/ }),
  ).toBeInViewport();
});
