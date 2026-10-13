import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { openDatabase } from "../server/database.js";
import { createApp } from "../server/app.js";

// Тестовата база е в уникална временна папка и не докосва потребителските задачи.
let db, server, base, folder;
const sample = {
  title: "API задача",
  description: "Описание",
  date: "2026-10-13",
  time: "09:00",
  duration: 45,
  status: "planned",
};
before(async () => {
  folder = mkdtempSync(join(tmpdir(), "todo-api-"));
  db = openDatabase(join(folder, "test.sqlite"));
  server = createApp(db, join(folder, "absent")).listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(folder, { recursive: true });
});
const send = (path, method = "GET", body) =>
  fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
test("Създава, чете, редактира и изтрива задача", async () => {
  const created = await send("/tasks", "POST", sample);
  assert.equal(created.status, 201);
  const task = await created.json();
  assert.equal(task.version, 1);
  assert.ok(
    (await (await send("/tasks")).json()).some((t) => t.id === task.id),
  );
  const edited = await send(`/tasks/${task.id}`, "PUT", {
    ...task,
    status: "completed",
  });
  assert.equal(edited.status, 200);
  const updated = await edited.json();
  assert.equal(updated.version, 2);
  assert.equal(updated.status, "completed");
  assert.equal(
    (await send(`/tasks/${task.id}?version=2`, "DELETE")).status,
    204,
  );
});
test("Не допуска презаписване или изтриване със стара версия", async () => {
  const task = await (await send("/tasks", "POST", sample)).json();
  await send(`/tasks/${task.id}`, "PUT", { ...task, title: "Актуална" });
  assert.equal((await send(`/tasks/${task.id}`, "PUT", task)).status, 409);
  assert.equal(
    (await send(`/tasks/${task.id}?version=1`, "DELETE")).status,
    409,
  );
});
test("Невалидните данни не създават записи", async () => {
  const count = (await (await send("/tasks")).json()).length;
  assert.equal(
    (await send("/tasks", "POST", { ...sample, duration: 0 })).status,
    400,
  );
  assert.equal((await (await send("/tasks")).json()).length, count);
});
test("Прилага филтри и отказва непознат статус", async () => {
  const task = await (
    await send("/tasks", "POST", { ...sample, status: "rejected" })
  ).json();
  assert.ok(
    (await (await send("/tasks?status=rejected")).json()).some(
      (t) => t.id === task.id,
    ),
  );
  assert.equal((await send("/tasks?status=missing")).status, 400);
});
test("Запазва текст, наподобяващ SQL команда, без изпълнение", async () => {
  const task = await (
    await send("/tasks", "POST", {
      ...sample,
      title: "'; DROP TABLE tasks; --",
    })
  ).json();
  assert.equal(task.title, "'; DROP TABLE tasks; --");
  assert.equal((await send("/tasks")).status, 200);
});
test("Отхвърля несъществуващ запис и липсваща версия", async () => {
  assert.equal((await send("/tasks/missing", "PUT", sample)).status, 404);
  const task = await (await send("/tasks", "POST", sample)).json();
  assert.equal((await send(`/tasks/${task.id}`, "PUT", sample)).status, 400);
  assert.equal((await send(`/tasks/${task.id}`, "DELETE")).status, 400);
});
test("Отказва чужд произход на браузърна заявка", async () => {
  const response = await fetch(base + "/tasks", {
    headers: { Origin: "https://foreign.example" },
  });
  assert.equal(response.status, 403);
});
// Адресът на реалния Vite интерфейс се допуска при запис, а не само при четене.
test("Допуска JSON запис от локалния интерфейс на 5173", async () => {
  const response = await fetch(base + "/tasks", {
    method: "POST", headers: { "Content-Type": "application/json", Origin: "http://127.0.0.1:5173" },
    body: JSON.stringify(sample),
  });
  assert.equal(response.status, 201);
  assert.ok(response.headers.get("content-type").includes("application/json"));
});
test("Файловата база съхранява запис след повторно отваряне", () => {
  const filename = join(folder, "persist.sqlite");
  const first = openDatabase(filename);
  first
    .prepare("INSERT INTO tasks VALUES(?,?,?,?,?,?,?,?,?,?)")
    .run(
      "persist",
      "Запазена",
      "",
      "2026-10-13",
      "10:00",
      60,
      "planned",
      1,
      "now",
      "now",
    );
  first.close();
  const second = openDatabase(filename);
  assert.equal(
    second.prepare("SELECT title FROM tasks WHERE id=?").get("persist").title,
    "Запазена",
  );
  second.close();
});
