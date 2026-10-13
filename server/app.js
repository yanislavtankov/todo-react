import express from "express";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { validateTask, STATUSES } from "./validation.js";

// Отделният конструктор позволява изолирани API тестове с временна база.
export function createApp(db, distPath = resolve("dist")) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  // Локалното приложение отказва браузърни заявки от чужд произход.
  app.use("/api", (req, res, next) => {
    const origin = req.get("origin");
    if (
      origin &&
      origin !== `http://${req.get("host")}` &&
      ![
        process.env.WEB_ORIGIN || "http://127.0.0.1:5173",
        "http://localhost:5173",
      ].includes(origin)
    )
      return res
        .status(403)
        .json({ error: "Неразрешен произход на заявката." });
    res.set("Cache-Control", "no-store");
    next();
  });
  const get = (id) => db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  // Филтрите са ограничени до известни полета; стойностите се подават като параметри.
  app.get("/api/tasks", (req, res) => {
    const clauses = [],
      values = [];
    if (req.query.status) {
      if (!STATUSES.includes(req.query.status))
        return res.status(400).json({ error: "Невалиден статус." });
      clauses.push("status = ?");
      values.push(req.query.status);
    }
    if (typeof req.query.q === "string" && req.query.q.trim()) {
      clauses.push(
        "(instr(lower(title), lower(?)) > 0 OR instr(lower(description), lower(?)) > 0)",
      );
      values.push(req.query.q.trim(), req.query.q.trim());
    }
    res.json(
      db
        .prepare(
          `SELECT * FROM tasks ${clauses.length ? "WHERE " + clauses.join(" AND ") : ""} ORDER BY date, time, created_at`,
        )
        .all(...values),
    );
  });
  app.post("/api/tasks", (req, res) => {
    let task;
    try {
      task = validateTask(req.body);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    const id = randomUUID(),
      now = new Date().toISOString();
    db.prepare(
      "INSERT INTO tasks(id,title,description,date,time,duration,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
    ).run(
      id,
      task.title,
      task.description,
      task.date,
      task.time,
      task.duration,
      task.status,
      now,
      now,
    );
    res.status(201).json(get(id));
  });
  app.put("/api/tasks/:id", (req, res) => {
    if (!get(req.params.id))
      return res.status(404).json({ error: "Задачата вече не съществува." });
    let task;
    try {
      task = validateTask(req.body);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    if (!Number.isInteger(req.body.version) || req.body.version < 1)
      return res
        .status(400)
        .json({ error: "Липсва валидна версия на задачата." });
    // Версията предотвратява безшумно презаписване от друг отворен прозорец.
    const result = db
      .prepare(
        `UPDATE tasks SET title=?,description=?,date=?,time=?,duration=?,status=?,
      updated_at=?,version=version+1 WHERE id=? AND version=?`,
      )
      .run(
        task.title,
        task.description,
        task.date,
        task.time,
        task.duration,
        task.status,
        new Date().toISOString(),
        req.params.id,
        req.body.version,
      );
    if (!result.changes)
      return res
        .status(409)
        .json({
          error:
            "Задачата е променена в друг прозорец. Обнови списъка и опитай отново.",
        });
    res.json(get(req.params.id));
  });
  app.delete("/api/tasks/:id", (req, res) => {
    if (!get(req.params.id))
      return res.status(404).json({ error: "Задачата вече не съществува." });
    const version = Number(req.query.version);
    if (!Number.isInteger(version) || version < 1)
      return res.status(400).json({ error: "Липсва валидна версия." });
    const result = db
      .prepare("DELETE FROM tasks WHERE id=? AND version=?")
      .run(req.params.id, version);
    if (!result.changes)
      return res
        .status(409)
        .json({
          error: "Задачата е променена. Обнови списъка преди изтриване.",
        });
    res.status(204).end();
  });
  // След компилиране същият процес обслужва и готовия React интерфейс.
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Несъществуващ API адрес." }),
  );
  if (existsSync(distPath)) app.use(express.static(distPath));
  app.use((error, _req, res, _next) => {
    if (error.type === "entity.too.large")
      return res.status(413).json({ error: "Заявката е прекалено голяма." });
    if (error instanceof SyntaxError)
      return res.status(400).json({ error: "Невалиден JSON." });
    console.error("Грешка при обработка:", error.message);
    res.status(500).json({ error: "Записът не е успешен. Опитай отново." });
  });
  return app;
}
