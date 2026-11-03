import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1EAAAAASUVORK5CYII=",
  "base64",
);
test("documents autosave, format, attach images, recover revisions and link work", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Documents", exact: true }).click();
  await page
    .getByRole("button", { name: "Create your first document" })
    .click();
  await page
    .getByRole("textbox", { name: "Document title", exact: true })
    .fill("Launch brief");
  const content = page.getByRole("textbox", {
    name: "Document content",
    exact: true,
  });
  await content.fill("A memorable client launch");
  await expect(page.locator(".document-topline [role=status]")).toHaveText(
    "Saved",
    { timeout: 15000 },
  );
  await page.reload();
  await page.getByRole("button", { name: "Documents", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Document title", exact: true }),
  ).toHaveValue("Launch brief");
  await expect(
    page.getByRole("textbox", { name: "Document content", exact: true }),
  ).toContainText("A memorable client launch");
  await page
    .getByRole("textbox", { name: "Document content", exact: true })
    .click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.getByRole("button", { name: "Insert table", exact: true }).click();
  await expect(page.locator(".document-prose table")).toHaveCount(1);
  await page.getByLabel("Insert image", { exact: true }).setInputFiles({
    name: "launch-art.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(page.locator(".document-image img")).toBeVisible();
  await page
    .getByLabel("Image caption", { exact: true })
    .fill("Our launch direction");
  await page.getByLabel("Image width", { exact: true }).press("Home");
  await expect(page.locator(".document-topline [role=status]")).toHaveText(
    "Saved",
    { timeout: 15000 },
  );
  await page
    .getByRole("textbox", { name: "Document title", exact: true })
    .fill("Launch brief final");
  await expect(page.locator(".document-topline [role=status]")).toHaveText(
    "Saved",
    { timeout: 15000 },
  );
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Document history" }),
  ).toBeVisible();
  await expect(page.locator(".revision-row")).not.toHaveCount(0);
  await page
    .locator(".revision-row")
    .first()
    .getByRole("button", { name: "Restore", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Document title", exact: true }),
  ).toHaveValue("Launch brief");
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);

  await page
    .getByRole("textbox", { name: "Document content", exact: true })
    .click();
  await page.keyboard.press("ControlOrMeta+Home");
  await page
    .getByRole("button", { name: "Selection → task", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: /Task RW-/ })).toBeVisible();
  await expect(
    page
      .getByRole("dialog", { name: /Task RW-/ })
      .getByText("Launch brief", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close task" }).click();
  await page.getByRole("button", { name: "Search anything" }).click();
  await page
    .getByRole("textbox", { name: "Search all work" })
    .fill("launch-art");
  await expect(
    page
      .locator(".search-results")
      .getByText("launch-art.png", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search all work" })
    .fill("Launch brief");
  await expect(
    page.locator(".search-results").getByText("Launch brief", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.screenshot({
    path: "/tmp/relaywork-documents-v020.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("task detail supports files, subtasks, reminders and recoverable bulk deletion", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator(".card-title")
    .filter({ hasText: "Brand guidelines" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Task RW-101" });
  await dialog
    .getByRole("textbox", { name: "Subtask title" })
    .fill("Prepare the first concept");
  await dialog
    .getByRole("button", { name: "Add subtask", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: /Prepare the first concept/ }),
  ).toBeVisible();
  await dialog.getByLabel("Upload task files").setInputFiles({
    name: "project-review.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n%%EOF"),
  });
  await expect(
    dialog.getByText("project-review.pdf", { exact: true }),
  ).toBeVisible();
  const future = new Date(Date.now() + 86400000);
  future.setMinutes(future.getMinutes() - future.getTimezoneOffset());
  await dialog
    .getByLabel("Reminder time", { exact: true })
    .fill(future.toISOString().slice(0, 16));
  await dialog
    .getByLabel("Reminder note", { exact: true })
    .fill("Review the concept");
  await dialog
    .getByRole("button", { name: "Set reminder", exact: true })
    .click();
  await expect(dialog.locator(".reminder-row")).toHaveCount(1);
  await dialog
    .getByRole("button", { name: "Cancel reminder", exact: true })
    .click();
  await expect(dialog.locator(".reminder-row")).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Delete task", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Trash", exact: true }).click();
  await expect(
    page
      .locator(".trash-row")
      .getByText("Brand guidelines & visual direction", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".trash-row")
      .getByText("Prepare the first concept", { exact: true }),
  ).toBeVisible();
  await page
    .locator(".trash-row")
    .filter({ hasText: "Brand guidelines & visual direction" })
    .getByRole("button", { name: "Restore", exact: true })
    .click();
  await expect(
    page
      .locator(".trash-row")
      .getByText("Prepare the first concept", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "List", exact: true }).click();
  await page
    .getByRole("checkbox", {
      name: "Select Gather customer testimonials",
      exact: true,
    })
    .check();
  await page
    .getByRole("checkbox", {
      name: "Select Write launch announcement",
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: "Move selected to trash" }).click();
  await page.getByRole("button", { name: "Trash", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Select all deleted tasks" })
    .check();
  await page.getByRole("button", { name: /Restore selected/ }).click();
  await expect(
    page.getByRole("heading", { name: "The trash is empty" }),
  ).toBeVisible();
});
test("document transactions, files, revocation, trash restoration and reminder delivery are permission safe", async ({
  playwright,
}) => {
  const owner = await playwright.request.newContext({
      baseURL: "http://localhost:3001",
      extraHTTPHeaders: { Origin: "http://localhost:3001" },
    }),
    guest = await playwright.request.newContext({
      baseURL: "http://localhost:3001",
      extraHTTPHeaders: { Origin: "http://localhost:3001" },
    }),
    nina = await playwright.request.newContext({
      baseURL: "http://localhost:3001",
      extraHTTPHeaders: { Origin: "http://localhost:3001" },
    });
  await owner.get("/api/state");
  await guest.post("/api/session", { data: { userId: "jordan" } });
  await nina.post("/api/session", { data: { userId: "nina" } });
  let response = await owner.post("/api/documents", {
    data: { projectId: "brand", title: "Security brief" },
  });
  expect(response.ok()).toBe(true);
  let doc = await response.json();
  response = await owner.post("/api/files", {
    multipart: {
      documentId: doc.id,
      file: { name: "protected.png", mimeType: "image/png", buffer: png },
    },
  });
  expect(response.status()).toBe(201);
  const attachment = await response.json();
  response = await owner.patch("/api/documents/" + doc.id, {
    data: {
      version: doc.version,
      title: "Security brief v2",
      body: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Controlled content" }],
          },
          {
            type: "image",
            attrs: {
              src: "/api/files/" + attachment.id,
              width: 70,
              caption: "Protected image",
            },
          },
        ],
      },
    },
  });
  expect(response.ok()).toBe(true);
  doc = await response.json();
  response = await owner.patch("/api/documents/" + doc.id, {
    data: { version: 1, title: "Stale update" },
  });
  expect(response.status()).toBe(412);
  response = await owner.get("/api/documents/" + doc.id + "/history");
  const history = await response.json();
  expect(history.revisions.length).toBeGreaterThan(0);
  response = await owner.post("/api/documents/" + doc.id + "/restore", {
    data: { version: doc.version, revisionId: history.revisions[0].id },
  });
  expect(response.ok()).toBe(true);
  expect((await response.json()).version).toBeGreaterThan(doc.version);
  response = await guest.patch("/api/documents/" + doc.id, {
    data: { version: 1, title: "Forbidden" },
  });
  expect(response.status()).toBe(403);
  response = await guest.post("/api/trash", {
    data: { operation: "delete", ids: ["RW-101"] },
  });
  expect(response.status()).toBe(403);
  response = await guest.get("/api/files/" + attachment.id);
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  response = await owner.post("/api/files", {
    multipart: {
      documentId: doc.id,
      file: {
        name: "script.svg",
        mimeType: "image/svg+xml",
        buffer: Buffer.from('<svg onload="alert(1)"></svg>'),
      },
    },
  });
  expect(response.status()).toBe(415);
  response = await owner.post("/api/documents/" + doc.id + "/links", {
    data: { taskId: "RW-114" },
  });
  expect(response.status()).toBe(422);
  response = await owner.post("/api/documents/" + doc.id + "/tasks", {
    data: { title: "From a document" },
  });
  const parent = await response.json();
  expect(response.ok()).toBe(true);
  response = await owner.post("/api/tasks/" + parent.id + "/subtasks", {
    data: { title: "First child" },
  });
  const child = await response.json();
  expect(response.ok()).toBe(true);
  response = await owner.post("/api/tasks/" + child.id + "/subtasks", {
    data: { title: "Too deeply nested" },
  });
  expect(response.status()).toBe(422);
  response = await nina.post("/api/trash", {
    data: { operation: "delete", ids: [parent.id, "RW-114"] },
  });
  expect(response.status()).toBe(404);
  let state = await (await owner.get("/api/state")).json();
  expect(
    state.tasks.find((t: { id: string }) => t.id === parent.id).deletedAt,
  ).toBeFalsy();
  const file = await (
    await owner.post("/api/files", {
      multipart: {
        taskId: child.id,
        file: {
          name: "child.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("%PDF-1.4\n%%EOF"),
        },
      },
    })
  ).json();
  await owner.post("/api/trash", {
    data: { operation: "delete", ids: [child.id] },
  });
  await owner.post("/api/trash", {
    data: { operation: "delete", ids: [parent.id] },
  });
  await owner.post("/api/trash", {
    data: { operation: "restore", ids: [parent.id] },
  });
  state = await (await owner.get("/api/state")).json();
  expect(
    state.tasks.find((t: { id: string }) => t.id === child.id).deletedAt,
  ).toBeTruthy();
  response = await owner.get("/api/files/" + file.id);
  expect(response.status()).toBe(404);
  await owner.post("/api/trash", {
    data: { operation: "restore", ids: [child.id] },
  });
  expect((await owner.get("/api/files/" + file.id)).status()).toBe(200);
  response = await owner.post("/api/reminders", {
    data: {
      taskId: parent.id,
      dueAt: new Date(Date.now() + 800).toISOString(),
      note: "Check now",
    },
  });
  expect(response.ok()).toBe(true);
  const reminder = await response.json();
  await new Promise((r) => setTimeout(r, 1000));
  await owner.get("/api/state");
  state = await (await owner.get("/api/state")).json();
  expect(
    state.notices.filter(
      (n: { id: string }) => n.id === "reminder-" + reminder.id,
    ),
  ).toHaveLength(1);
  await owner.post("/api/projects/brand/grants", {
    data: { userId: "jordan", grant: null },
  });
  response = await guest.get("/api/files/" + attachment.id);
  expect(response.status()).toBe(404);
  response = await guest.get("/api/documents/" + doc.id + "/history");
  expect(response.status()).toBe(404);
  state = await (await guest.get("/api/state")).json();
  expect(state.documents).toEqual([]);
  expect(state.attachments).toEqual([]);
  await owner.post("/api/projects/brand/grants", {
    data: { userId: "jordan", grant: "Comment" },
  });
  await owner.dispose();
  await guest.dispose();
  await nina.dispose();
});

test("documents remain usable on a narrow phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "Documents", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Document content", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("global search opens a document from another authorized project", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Brand launch", exact: true }),
  ).toBeVisible();
  const response = await page.request.post("/api/documents", {
    headers: { Origin: "http://localhost:3001" },
    data: { projectId: "website", title: "Website handoff plan" },
  });
  expect(response.ok()).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "Search anything" }).click();
  await page
    .getByRole("textbox", { name: "Search all work" })
    .fill("Website handoff plan");
  await page
    .locator(".search-results")
    .getByRole("button", { name: /Website handoff plan/ })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Document title", exact: true }),
  ).toHaveValue("Website handoff plan");
  await expect(
    page.getByRole("heading", { name: "Website refresh", exact: true }),
  ).toBeVisible();
});

test("documents accept pasted and dropped image files", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Documents", exact: true }).click();
  await page
    .getByRole("button", { name: "Create document", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Document title", exact: true }),
  ).toHaveValue("Untitled document");
  await page
    .getByRole("textbox", { name: "Document title", exact: true })
    .fill("Image gesture imports");
  const editor = page.getByRole("textbox", {
    name: "Document content",
    exact: true,
  });
  await editor.fill("Image gestures");
  await editor.evaluate((element, bytes) => {
    const data = new DataTransfer();
    data.items.add(
      new File([new Uint8Array(bytes)], "pasted-image.png", {
        type: "image/png",
      }),
    );
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, Array.from(png));
  await expect(page.locator(".document-image img")).toHaveCount(1);
  await editor.evaluate((element, bytes) => {
    const data = new DataTransfer();
    data.items.add(
      new File([new Uint8Array(bytes)], "dropped-image.png", {
        type: "image/png",
      }),
    );
    element.dispatchEvent(
      new DragEvent("drop", {
        clientX: element.getBoundingClientRect().left + 20,
        clientY: element.getBoundingClientRect().top + 20,
        dataTransfer: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, Array.from(png));
  await expect(page.locator(".document-image img")).toHaveCount(2);
  await expect(page.locator(".document-topline [role=status]")).toHaveText(
    "Saved",
    { timeout: 15000 },
  );
  await page.reload();
  await page.getByRole("button", { name: "Documents", exact: true }).click();
  await page
    .locator(".document-list")
    .getByRole("button", { name: /Image gesture imports/ })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Document title", exact: true }),
  ).toHaveValue("Image gesture imports");
  await expect(page.locator(".document-image img")).toHaveCount(2);
});

test("attachment size limits survive the desktop request proxy", async ({
  playwright,
}) => {
  const client = await playwright.request.newContext({
    baseURL: "http://localhost:3001",
    extraHTTPHeaders: { Origin: "http://localhost:3001" },
  });
  await client.get("/api/state");
  const bytes = Buffer.alloc(11 * 1024 * 1024);
  bytes.write("%PDF-1.4\n");
  const upload = await client.post("/api/files", {
    multipart: {
      taskId: "RW-101",
      file: {
        name: "large-review.pdf",
        mimeType: "application/pdf",
        buffer: bytes,
      },
    },
  });
  expect(upload.status()).toBe(201);
  const file = await upload.json();
  expect(file.size).toBe(bytes.length);
  const download = await client.get("/api/files/" + file.id);
  expect(download.status()).toBe(200);
  expect((await download.body()).equals(bytes)).toBe(true);
  expect((await client.delete("/api/files/" + file.id)).ok()).toBe(true);
  const oversized = Buffer.alloc(26 * 1024 * 1024);
  oversized.write("%PDF-1.4\n");
  const rejected = await client.post("/api/files", {
    multipart: {
      taskId: "RW-101",
      file: {
        name: "too-large.pdf",
        mimeType: "application/pdf",
        buffer: oversized,
      },
    },
  });
  expect(rejected.status()).toBe(413);
  await client.dispose();
});
