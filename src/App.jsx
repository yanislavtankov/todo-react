import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ListTodo,
  Plus,
  Search,
  ArrowUpRight,
  Check,
  Clock3,
  Circle,
  Download,
  RefreshCw,
  Sparkles,
  LayoutGrid,
} from "lucide-react";
import TaskDialog from "./TaskDialog.jsx";
import { request } from "./api.js";
import {
  STATUS,
  dateKey,
  formatDate,
  durationLabel,
  startOf,
  endOf,
} from "./domain.js";

// Календарният модул се изтегля при първо отваряне, за да се намали началният пакет.
const CalendarView = lazy(() => import("./CalendarView.jsx"));

// Основният компонент свързва зареждането, филтрите и двата изгледа на задачите.
export default function App() {
  const [tasks, setTasks] = useState([]),
    [view, setView] = useState("list");
  const [filter, setFilter] = useState("all"),
    [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [dialog, setDialog] = useState(null),
    [message, setMessage] = useState("");
  const [updating, setUpdating] = useState(null);
  const today = dateKey();
  async function load() {
    setLoading(true);
    setError("");
    try {
      setTasks(await request());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 4500);
    return () => clearTimeout(timer);
  }, [message]);
  // Търсенето на клиента използва Unicode и работи и с български букви.
  const filtered = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (filter === "all" ||
            (filter === "today" ? t.date === today : t.status === filter)) &&
          `${t.title} ${t.description}`
            .toLocaleLowerCase("bg")
            .includes(query.toLocaleLowerCase("bg")),
      ),
    [tasks, filter, query, today],
  );
  const counts = {
    all: tasks.length,
    today: tasks.filter((t) => t.date === today).length,
  };
  Object.keys(STATUS).forEach((s) => {
    counts[s] = tasks.filter((t) => t.status === s).length;
  });
  const minutes = tasks
    .filter((t) => t.date === today && t.status !== "rejected")
    .reduce((sum, t) => sum + t.duration, 0);
  // Интерфейсът се актуализира след успешен запис, без оптимистично загубване на данни.
  async function save(form) {
    try {
      const result = await request(form.id ? `/${form.id}` : "", {
        method: form.id ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      setTasks((current) =>
        [...current.filter((t) => t.id !== result.id), result].sort(
          (a, b) => startOf(a) - startOf(b),
        ),
      );
      setMessage(form.id ? "Промените са запазени." : "Задачата е добавена.");
    } catch (err) {
      if (err.status === 409 || err.status === 404) await load();
      throw err;
    }
  }
  async function remove(task) {
    try {
      await request(`/${task.id}?version=${task.version}`, {
        method: "DELETE",
      });
      setTasks((current) => current.filter((t) => t.id !== task.id));
      setMessage("Задачата е изтрита.");
    } catch (err) {
      if (err.status === 409 || err.status === 404) await load();
      throw err;
    }
  }
  async function setStatus(task, status) {
    setUpdating(task.id);
    setError("");
    try {
      await save({ ...task, status });
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(null);
    }
  }
  // Експортът включва текущите записи, независимо от приложените филтри.
  function exportTasks() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { exportedAt: new Date().toISOString(), tasks },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `tasks-${today}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Файлът със задачите е изтеглен.");
  }
  const groups = [...new Set(filtered.map((t) => t.date))].sort();
  return (
    <div className="app-layout min-h-screen">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Ден по ден — начало">
          <span className="brand-icon">
            <Check size={24} strokeWidth={3} />
          </span>
          <span>
            ден по ден
            <span className="brand-sub">ПОВЕЧЕ ЯСНОТА. ПО-МАЛКО ХАОС.</span>
          </span>
        </a>
        <span className="nav-label">РАБОТНО ПРОСТРАНСТВО</span>
        <nav aria-label="Основна навигация">
          <button
            className={view === "list" ? "nav-item active" : "nav-item"}
            onClick={() => setView("list")}
          >
            <ListTodo size={20} />
            Моите задачи<span>{tasks.length}</span>
          </button>
          <button
            className={view === "calendar" ? "nav-item active" : "nav-item"}
            onClick={() => setView("calendar")}
          >
            <CalendarDays size={20} />
            Календар
            <ArrowUpRight size={16} />
          </button>
        </nav>
        <div className="sidebar-note">
          <Sparkles size={22} />
          <h3>Място за важните неща.</h3>
          <p>Подреди деня си, остави време за себе си.</p>
          <button
            onClick={() => {
              setFilter("today");
              setView("list");
            }}
          >
            Поглед към днес <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="sidebar-footer">
          <span className="connection-dot" />
          Локална SQLite база<small>Задачите остават на този компютър.</small>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            <LayoutGrid size={16} />
            Лично пространство <span className="slash">/</span>{" "}
            <strong>{view === "list" ? "Задачи" : "Календар"}</strong>
          </span>
          <span className="today-label">
            {new Intl.DateTimeFormat("bg-BG", {
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(new Date())}
          </span>
        </header>
        <div className="main-content">
          <section className="page-heading">
            <div>
              <p className="eyebrow">ПЛАНИРАЙ С ЛЕКОТА</p>
              <h1>
                {view === "list"
                  ? "Твоят ден, подреден."
                  : "Време за твоите планове."}
              </h1>
              <p className="subtitle">
                {view === "list"
                  ? "Всичко, което предстои — с ясен план и спокойно темпо."
                  : "Виж кога започва всяка задача и колко време ѝ отделяш."}
              </p>
            </div>
            <button
              className="primary"
              onClick={() => setDialog({ date: today })}
            >
              <Plus size={20} />
              Нова задача
            </button>
          </section>
          {/* Обобщението се изчислява от реалните записи и не зависи от филтъра. */}
          <section className="stats" aria-label="Обобщение">
            <Stat
              label="Задачи за днес"
              value={counts.today}
              note="един ден, ясни приоритети"
              icon={<CalendarDays />}
            />
            <Stat
              label="В изпълнение"
              value={counts.in_progress}
              note="малка стъпка, всеки път"
              icon={<Clock3 />}
            />
            <Stat
              label="Изпълнени"
              value={counts.completed}
              note="всяка отметка е напредък"
              icon={<Check />}
            />
            <Stat
              label="Планирано време днес"
              value={durationLabel(minutes)}
              note="сбор на активните интервали"
              icon={<Circle />}
            />
          </section>
          <section className="workspace">
            <div className="workspace-toolbar">
              <div className="view-tabs">
                <button
                  className={view === "list" ? "selected" : ""}
                  onClick={() => setView("list")}
                >
                  <ListTodo size={17} />
                  Списък
                </button>
                <button
                  className={view === "calendar" ? "selected" : ""}
                  onClick={() => setView("calendar")}
                >
                  <CalendarDays size={17} />
                  Календар
                </button>
              </div>
              <div className="toolbar-right">
                <label className="search">
                  <Search size={18} />
                  <input
                    aria-label="Търсене на задачи"
                    placeholder="Намери задача…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <button
                  className="icon-btn"
                  title="Обнови задачите"
                  aria-label="Обнови задачите"
                  onClick={load}
                  disabled={loading}
                >
                  <RefreshCw size={18} />
                </button>
                <button
                  className="icon-btn"
                  title="Експорт в JSON"
                  aria-label="Експорт в JSON"
                  onClick={exportTasks}
                >
                  <Download size={18} />
                </button>
              </div>
            </div>
            <div className="filters" aria-label="Филтри">
              <Filter
                id="all"
                label="Всички"
                filter={filter}
                setFilter={setFilter}
                count={counts.all}
              />
              <Filter
                id="today"
                label="Днес"
                filter={filter}
                setFilter={setFilter}
                count={counts.today}
              />
              {Object.entries(STATUS).map(([id, s]) => (
                <Filter
                  key={id}
                  id={id}
                  label={s.label}
                  filter={filter}
                  setFilter={setFilter}
                  count={counts[id]}
                />
              ))}
            </div>
            {error && (
              <div className="error" role="alert">
                {error}
                <button className="text-btn" onClick={load}>
                  Опитай отново
                </button>
              </div>
            )}
            {loading ? (
              <div className="empty">
                <RefreshCw className="spin" />
                <h2>Зареждане на задачите…</h2>
              </div>
            ) : view === "calendar" ? (
              <Suspense
                fallback={<div className="empty">Зареждане на календара…</div>}
              >
                <CalendarView
                  tasks={filtered}
                  onEdit={(task) => setDialog({ task })}
                  onCreate={(date) => setDialog({ date })}
                />
              </Suspense>
            ) : filtered.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">
                  <ListTodo size={34} />
                </div>
                <h2>
                  {tasks.length === 0
                    ? "Един добър ден започва с план."
                    : "Няма задачи в този изглед."}
                </h2>
                <p>
                  {tasks.length === 0
                    ? "Добави първата си задача и ѝ отдели време в календара."
                    : "Промени търсенето или избери друг статус."}
                </p>
                <button
                  className="secondary"
                  onClick={() => setDialog({ date: today })}
                >
                  <Plus size={17} />
                  Добави задача
                </button>
              </div>
            ) : (
              <div className="task-groups">
                {groups.map((date) => (
                  <section key={date}>
                    <div className="group-title">
                      <h2>{date === today ? "Днес" : formatDate(date)}</h2>
                      <span>
                        {date === today ? formatDate(date) : date.slice(0, 4)}
                      </span>
                      <i />
                      <span>
                        {filtered.filter((t) => t.date === date).length} задачи
                      </span>
                    </div>
                    {filtered
                      .filter((t) => t.date === date)
                      .map((task) => (
                        <article
                          className={`task-card ${task.status === "completed" ? "done" : ""}`}
                          key={task.id}
                        >
                          <button
                            className={`check-btn ${task.status === "completed" ? "checked" : ""}`}
                            disabled={updating === task.id}
                            aria-label={
                              task.status === "completed"
                                ? `Върни ${task.title} в планирани`
                                : `Завърши ${task.title}`
                            }
                            onClick={() =>
                              setStatus(
                                task,
                                task.status === "completed"
                                  ? "planned"
                                  : "completed",
                              )
                            }
                          >
                            {task.status === "completed" && <Check size={16} />}
                          </button>
                          <button
                            className="task-text"
                            onClick={() => setDialog({ task })}
                          >
                            <h3>{task.title}</h3>
                            {task.description && <p>{task.description}</p>}
                            <span className="task-meta">
                              <Clock3 size={14} />
                              {task.time} –{" "}
                              {endOf(task).toLocaleTimeString("bg-BG", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                              {dateKey(endOf(task)) !== task.date
                                ? " (+1 ден)"
                                : ""}
                              <span>·</span>
                              {durationLabel(task.duration)}
                            </span>
                          </button>
                          <select
                            className={`status-select ${STATUS[task.status].className}`}
                            aria-label={`Статус на ${task.title}`}
                            value={task.status}
                            disabled={updating === task.id}
                            onChange={(e) => setStatus(task, e.target.value)}
                          >
                            {Object.entries(STATUS).map(([id, s]) => (
                              <option key={id} value={id}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                          <button
                            className="icon-btn edit-arrow"
                            aria-label={`Редактирай ${task.title}`}
                            onClick={() => setDialog({ task })}
                          >
                            <ArrowUpRight size={19} />
                          </button>
                        </article>
                      ))}
                  </section>
                ))}
              </div>
            )}
            <div className="workspace-footer">
              <span>
                {filtered.length} от {tasks.length} задачи
              </span>
              <span>Една задача по-малко. Една стъпка напред.</span>
            </div>
          </section>
          <footer className="page-footer">
            Ден по ден <span>·</span> Създадено с React <span>·</span> Локално
            съхранение
          </footer>
        </div>
      </main>
      {/* Известията се прочитат от помощните технологии, без да преместват фокуса. */}
      <div className={message ? "toast visible" : "toast"} role="status">
        {message && (
          <>
            <Check size={18} />
            {message}
          </>
        )}
      </div>
      {dialog && (
        <TaskDialog
          key={dialog.task?.id || dialog.date}
          task={dialog.task}
          date={dialog.date}
          tasks={tasks}
          onClose={() => setDialog(null)}
          onSave={save}
          onDelete={remove}
        />
      )}
    </div>
  );
}
// Малките представящи компоненти не съдържат самостоятелно бизнес състояние.
function Stat({ label, value, note, icon }) {
  return (
    <article className="stat-card">
      <div>
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}
function Filter({ id, label, filter, setFilter, count }) {
  return (
    <button
      aria-pressed={filter === id}
      className={filter === id ? "filter active" : "filter"}
      onClick={() => setFilter(id)}
    >
      {label}
      <span>{count}</span>
    </button>
  );
}
