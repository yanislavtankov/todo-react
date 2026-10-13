import { defineConfig } from "@playwright/test";
// Отделната база за браузърни тестове изолира тестовите записи от работния файл.
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  reporter: [["list"], ["json", { outputFile: "test-results/results.json" }]],
  use: {
    baseURL: "http://127.0.0.1:5180",
    browserName: "chromium",
    channel: "chrome",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node server/index.js",
      url: "http://127.0.0.1:3002/api/health",
      env: {
        PORT: "3002",
        DB_PATH: "data/e2e.sqlite",
        WEB_ORIGIN: "http://127.0.0.1:5180",
      },
      reuseExistingServer: false,
    },
    {
      command: "vite --port 5180",
      url: "http://127.0.0.1:5180",
      env: { API_PORT: "3002" },
      reuseExistingServer: false,
    },
  ],
});
