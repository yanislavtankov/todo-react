import { useEffect, useRef, useState } from "react";
import { X, Clock3, Trash2, Save } from "lucide-react";
import { STATUS, dateKey, overlaps } from "./domain.js";

// Нативният диалог осигурява фокус, затваряне с Escape и модално поведение.
export default function TaskDialog({
  task,
  date,
  tasks,
  onClose,
  onSave,
  onDelete,
}) {
  const ref = useRef(null);
  const [form, setForm] = useState(
    task || {
      title: "",
      description: "",
      date: date || dateKey(),
      time: "09:00",
      duration: 60,
      status: "planned",
    },
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    ref.current.showModal();
  }, []);
  // Формата пази отделна чернова до успешно потвърждение от сървъра.
  const change = (e) =>
    setForm({
      ...form,
      [e.target.name]:
        e.target.name === "duration" ? Number(e.target.value) : e.target.value,
    });
  const conflicts = tasks.filter((other) => overlaps(form, other));
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError("");
    try {
      await onDelete(task);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
    >
      <form onSubmit={submit}>
        <div className="dialog-head">
          <div>
            <span className="eyebrow">ТВОЕТО ВРЕМЕ</span>
            <h2 id="dialog-title">
              {task ? "Редактиране на задача" : "Нова задача"}
            </h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="Затвори"
            onClick={onClose}
            disabled={busy}
          >
            <X size={21} />
          </button>
        </div>
        {/* Всеки контрол има видим етикет и ограничения, съответстващи на API. */}
        <label>
          Заглавие
          <input
            autoFocus
            name="title"
            placeholder="Какво предстои?"
            value={form.title}
            onChange={change}
            required
            maxLength={120}
          />
        </label>
        <label>
          Описание <span className="muted">· по избор</span>
          <textarea
            name="description"
            placeholder="Детайли, които ще ти помогнат…"
            value={form.description}
            onChange={change}
            maxLength={2000}
            rows={3}
          />
        </label>
        <div className="form-row">
          <label>
            Дата
            <input
              type="date"
              name="date"
              min="2000-01-01"
              max="2100-12-31"
              value={form.date}
              onChange={change}
              required
            />
          </label>
          <label>
            Начален час
            <input
              type="time"
              name="time"
              value={form.time}
              onChange={change}
              required
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            Продължителност (мин)
            <input
              type="number"
              name="duration"
              min={5}
              max={1440}
              step={1}
              value={form.duration}
              onChange={change}
              required
            />
          </label>
          <label>
            Статус
            <select name="status" value={form.status} onChange={change}>
              {Object.entries(STATUS).map(([id, s]) => (
                <option key={id} value={id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {/* Застъпването е предупреждение, защото паралелните ангажименти са допустими. */}
        {conflicts.length > 0 && (
          <p className="notice">
            <Clock3 size={17} />
            Застъпва се с {conflicts.length}{" "}
            {conflicts.length === 1 ? "друга задача" : "други задачи"}. Записът
            е разрешен.
          </p>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {confirmDelete && (
          <div className="delete-confirm">
            <p>
              Да се изтрие ли „{task.title}“? Това действие премахва задачата.
            </p>
            <button
              type="button"
              className="danger"
              disabled={busy}
              onClick={remove}
            >
              Потвърди изтриването
            </button>
            <button
              type="button"
              className="text-btn"
              disabled={busy}
              onClick={() => setConfirmDelete(false)}
            >
              Отказ
            </button>
          </div>
        )}
        <div className="dialog-actions">
          {task && (
            <button
              type="button"
              className="text-btn danger-text"
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={17} />
              Изтрий
            </button>
          )}
          <div className="grow" />
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Отказ
          </button>
          <button className="primary" disabled={busy}>
            <Save size={17} />
            {busy ? "Записва се…" : "Запази задача"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
