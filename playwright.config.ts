import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://localhost:3001",
    headless: true,
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command:
      "RELAYWORK_DEMO=1 RELAYWORK_DATA_DIR=/tmp/relaywork-tests-" +
      Date.now() +
      " npm start -- --port 3001",
    url: "http://localhost:3001",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
