// Статусите са общ договор между интерфейса, API и SQLite ограниченията.
export const STATUSES = ["planned", "in_progress", "rejected", "completed"];

// Локалната дата се пази без часова зона: календарът следва часовника на потребителя.
export function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    year >= 2000 &&
    year <= 2100 &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

// Нормализирането се изпълнява на сървъра дори при заобикаляне на формуляра.
export function validateTask(body) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new Error("Невалидни данни.");
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  if (!title || title.length > 120)
    throw new Error("Заглавието трябва да съдържа от 1 до 120 знака.");
  if (description.length > 2000)
    throw new Error("Описанието може да съдържа до 2000 знака.");
  if (!validDate(body.date))
    throw new Error("Избери валидна дата между 2000 и 2100 година.");
  if (
    typeof body.time !== "string" ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time)
  )
    throw new Error("Началният час трябва да е във формат ЧЧ:ММ.");
  if (
    !Number.isInteger(body.duration) ||
    body.duration < 5 ||
    body.duration > 1440
  )
    throw new Error(
      "Продължителността трябва да е цяло число между 5 и 1440 минути.",
    );
  if (!STATUSES.includes(body.status))
    throw new Error("Невалиден статус на задача.");
  return {
    title,
    description,
    date: body.date,
    time: body.time,
    duration: body.duration,
    status: body.status,
  };
}
