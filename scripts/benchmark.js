import { performance } from "node:perf_hooks";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { openDatabase } from "../server/database.js";
import { createApp } from "../server/app.js";

// Измерването използва само нова временна база с 1000 синтетични задачи.
const folder = mkdtempSync(join(tmpdir(), "todo-benchmark-"));
const db = openDatabase(join(folder, "benchmark.sqlite"));
const insert = db.prepare("INSERT INTO tasks VALUES(?,?,?,?,?,?,?,?,?,?)");
db.exec("BEGIN");
for (let i = 0; i < 1000; i++) insert.run(`bench-${i}`, `Задача ${i}`, "Синтетичен запис", "2026-10-13", "09:00", 60, "planned", 1, "2026-10-13T00:00:00Z", "2026-10-13T00:00:00Z");
db.exec("COMMIT");
const server = createApp(db, join(folder, "absent")).listen(0, "127.0.0.1");
await once(server, "listening");
const url = `http://127.0.0.1:${server.address().port}/api/tasks`;
try {
  // Пет предварителни заявки се изключват от измерваните 50 наблюдения.
  for (let i = 0; i < 5; i++) await (await fetch(url)).json();
  const samples = [];
  for (let i = 0; i < 50; i++) {
    const started = performance.now();
    const result = await (await fetch(url)).json();
    if (result.length !== 1000) throw new Error("Непълен резултат при измерване.");
    samples.push(performance.now() - started);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const report = { date: "2026-10-13", records: 1000, samples: 50, warmup: 5, node: process.version,
    sqlite: db.prepare("SELECT sqlite_version() AS version").get().version,
    meanMs: samples.reduce((a, b) => a + b, 0) / samples.length,
    medianMs: (sorted[24] + sorted[25]) / 2, p95Ms: sorted[Math.ceil(0.95 * sorted.length) - 1], maxMs: sorted.at(-1), samplesMs: samples };
  console.log(JSON.stringify(report, null, 2));
} finally {
  // Премахва се единствено директорията, създадена от текущото измерване.
  await new Promise(resolve => server.close(resolve)); db.close(); rmSync(folder, { recursive: true });
}
