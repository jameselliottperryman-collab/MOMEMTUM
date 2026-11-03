import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron, expect } from "@playwright/test";
const packaged = process.env.RELAYWORK_DESKTOP_EXECUTABLE;
const profile = await mkdtemp(join(tmpdir(), "relaywork-desktop-test-"));
async function launch() {
  return electron.launch({
    ...(packaged ? { executablePath: resolve(packaged) } : {}),
    args: [
      "--no-sandbox",
      "--disable-gpu",
      ...(packaged ? [] : [resolve("desktop/main.cjs")]),
    ],
    env: { ...process.env, RELAYWORK_DESKTOP_PROFILE: profile },
    timeout: 60000,
  });
}
async function nativeAction(app, label) {
  await app.evaluate(({ Menu }, text) => {
    for (const top of Menu.getApplicationMenu().items) {
      const item = top.submenu?.items.find((i) => i.label === text);
      if (item) {
        item.click();
        return;
      }
    }
    throw Error("Native menu item not found: " + text);
  }, label);
}
async function waitFile(path) {
  for (let i = 0; i < 100; i++) {
    try {
      await access(path);
      return await readFile(path, "utf8");
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw Error("Download did not complete");
}
test(
  "native desktop launches its private server, edits tasks, exports CSV, enforces reviewer access, persists on restart and stops its server",
  { timeout: 120000 },
  async () => {
    let app = await launch();
    let page;
    try {
      page = await app.firstWindow();
      await expect(
        page.getByRole("heading", { name: "Brand launch", exact: true }),
      ).toBeVisible({ timeout: 45000 });
      const origin = new URL(page.url()).origin;
      const security = await app.evaluate(({ BrowserWindow }) => {
        const w = BrowserWindow.getAllWindows()[0],
          p = w.webContents.getLastWebPreferences();
        return {
          node: p.nodeIntegration,
          isolation: p.contextIsolation,
          sandbox: p.sandbox,
        };
      });
      assert.deepEqual(security, {
        node: false,
        isolation: true,
        sandbox: true,
      });
      assert.equal(
        await page.evaluate(() => typeof window.require),
        "undefined",
      );
      assert.equal(
        await page.evaluate(() => typeof window.relayworkDesktop?.onAction),
        "function",
      );
      assert.equal(
        (await fetch(origin + "/api/state")).status,
        403,
        "Unauthenticated local requests must be rejected",
      );
      assert.equal(
        await page.evaluate(async () => {
          const r = await fetch("/api/state");
          return r.status;
        }),
        200,
      );
      const blocked = await page.evaluate(async () => {
        try {
          await fetch("https://example.com/");
          return false;
        } catch {
          return true;
        }
      });
      assert.equal(blocked, true, "Renderer must not fetch remote resources");
      await page.getByRole("button", { name: "Share", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Copy link", exact: true }),
      ).toHaveCount(0);
      await page.getByRole("button", { name: "Done", exact: true }).click();
      await nativeAction(app, "New task");
      await page
        .getByRole("textbox", { name: "Task name" })
        .fill("Native desktop review");
      await page
        .getByRole("button", { name: "Create task", exact: true })
        .click();
      const detail = page.getByRole("dialog", { name: /Task RW-/ });
      await expect(detail).toBeVisible();
      await detail
        .getByLabel("Task status", { exact: true })
        .selectOption("In review");
      await expect(
        detail.getByLabel("Task priority", { exact: true }),
      ).toBeEnabled();
      await detail
        .getByLabel("Write a comment")
        .fill("Created and reviewed in the desktop app.");
      await detail.getByRole("button", { name: "Post comment" }).click();
      await expect(
        detail.getByText("Created and reviewed in the desktop app.", {
          exact: true,
        }),
      ).toBeVisible();
      await detail.getByRole("button", { name: "Close task" }).click();
      await nativeAction(app, "Search tasks…");
      await page
        .getByPlaceholder("Search by task name, ID, or keyword...")
        .fill("Native desktop review");
      await expect(
        page.locator(".search-results").getByText("Native desktop review"),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      const csvPath = join(profile, "native-export.csv");
      await app.evaluate(
        ({ BrowserWindow }, path) =>
          BrowserWindow.getAllWindows()[0].webContents.session.once(
            "will-download",
            (_event, item) => item.setSavePath(path),
          ),
        csvPath,
      );
      await page.getByRole("button", { name: "Filter", exact: true }).click();
      await page
        .getByRole("button", { name: "Export CSV", exact: true })
        .click();
      const csv = await waitFile(csvPath);
      assert.match(csv, /Native desktop review/);
      await page.locator(".account-button").click();
      await page
        .locator(".account-popover")
        .getByRole("button", { name: /Jordan Lee/ })
        .click();
      await expect(page.locator(".account-button")).toBeVisible();
      assert.equal(
        await page.evaluate(async () => {
          const r = await fetch("/api/tasks/RW-101", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: "Forbidden desktop edit",
              version: 1,
            }),
          });
          return r.status;
        }),
        403,
      );
      await nativeAction(app, "New task");
      await expect(page.getByRole("status")).toContainText("edit access");
      await page.locator(".account-button").click();
      await page
        .locator(".account-popover")
        .getByRole("button", { name: /Alex Morgan/ })
        .click();
      await expect(page.locator(".account-button")).toBeVisible();
      await expect(page.locator(".account-popover")).not.toBeVisible();
      await page.screenshot({
        path: "/tmp/relaywork-native-desktop.png",
        fullPage: true,
      });
      await app.close();
      app = null;
      for (let i = 0; i < 50; i++) {
        try {
          await fetch(origin + "/api/state");
          await new Promise((r) => setTimeout(r, 100));
        } catch {
          break;
        }
      }
      await assert.rejects(
        fetch(origin + "/api/state"),
        "Closing the app must stop its private server",
      );
      app = await launch();
      page = await app.firstWindow();
      await expect(
        page.getByRole("heading", { name: "Brand launch", exact: true }),
      ).toBeVisible({ timeout: 45000 });
      assert.equal(
        new URL(page.url()).origin,
        origin,
        "Stable local origin preserves saved browser views",
      );
      await page
        .getByRole("button", { name: "Native desktop review", exact: true })
        .click();
      await expect(
        page
          .getByRole("dialog", { name: /Task RW-/ })
          .getByText("Created and reviewed in the desktop app.", {
            exact: true,
          }),
      ).toBeVisible();
    } finally {
      if (app) await app.close();
    }
  },
);
