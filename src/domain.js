// Всяко състояние получава едновременно цвят и текстово име.
export const STATUS = {
  planned: { label: "Планирана", color: "#7653db", className: "planned" },
  in_progress: {
    label: "Изпълнява се",
    color: "#267ab4",
    className: "progress",
  },
  completed: { label: "Изпълнена", color: "#21856a", className: "completed" },
  rejected: { label: "Отхвърлена", color: "#9a5665", className: "rejected" },
};
// Форматирането избягва UTC преобразуване, което може да измести календарния ден.
export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function startOf(task) {
  return new Date(`${task.date}T${task.time}:00`);
}
export function endOf(task) {
  return new Date(startOf(task).getTime() + task.duration * 60000);
}
export function formatDate(date) {
  return new Intl.DateTimeFormat("bg-BG", {
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T12:00:00`));
}
export function durationLabel(minutes) {
  return minutes < 60
    ? `${minutes} мин`
    : `${Math.floor(minutes / 60)} ч${minutes % 60 ? ` ${minutes % 60} мин` : ""}`;
}
// Допиращи се интервали не се считат за застъпване; отхвърлените задачи не заемат време.
export function overlaps(a, b) {
  return (
    a.id !== b.id &&
    a.status !== "rejected" &&
    b.status !== "rejected" &&
    startOf(a) < endOf(b) &&
    startOf(b) < endOf(a)
  );
}
