import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// The tests run their own copy of the app on port 3100 (never the dev server on 3000), with its own build folder and an empty, throw-away data folder.
const PORT = 3100;
const dataDir = path.join(process.cwd(), ".e2e-data");
if (!process.env.TEST_WORKER_INDEX) fs.rmSync(dataDir, { recursive: true, force: true });

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", viewport: { width: 1366, height: 800 } },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 800 } } }],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: { NEXT_DIST_DIR: ".next-e2e", KOINBX_DATA_DIR: dataDir, KOINBX_BACKUP_DIR: path.join(dataDir, "backups"), KOINBX_TIMEZONE: "Asia/Kolkata", NEXT_TELEMETRY_DISABLED: "1" },
  },
});
