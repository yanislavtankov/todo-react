import test from "node:test";
import assert from "node:assert/strict";
import { validateTask, validDate } from "../server/validation.js";
import { overlaps, endOf, dateKey } from "../src/domain.js";

// Базовите данни се използват само в изолирани проверки на гранични случаи.
const task = {
  title: "Тест",
  description: "",
  date: "2026-10-13",
  time: "23:30",
  duration: 60,
  status: "planned",
};
test("Валидира високосна дата и отхвърля несъществуващ ден", () => {
  assert.equal(validDate("2024-02-29"), true);
  assert.equal(validDate("2025-02-29"), false);
  assert.equal(validDate("2026-04-31"), false);
});
test("Премахва външните интервали в заглавието", () => {
  assert.equal(validateTask({ ...task, title: "  Среща  " }).title, "Среща");
});
test("Отхвърля празно заглавие, неправилен час, статус и продължителност", () => {
  for (const patch of [
    { title: " " },
    { time: "24:00" },
    { duration: 4 },
    { duration: 1441 },
    { duration: 5.5 },
    { status: "other" },
  ])
    assert.throws(() => validateTask({ ...task, ...patch }));
});
test("Приема минималната и максималната продължителност", () => {
  assert.equal(validateTask({ ...task, duration: 5 }).duration, 5);
  assert.equal(validateTask({ ...task, duration: 1440 }).duration, 1440);
});
test("Изчислява край на задача след полунощ", () => {
  assert.equal(dateKey(endOf(task)), "2026-10-14");
  assert.equal(endOf(task).getHours(), 0);
  assert.equal(endOf(task).getMinutes(), 30);
});
test("Разграничава застъпване, допиране и отхвърлен интервал", () => {
  const a = { ...task, id: "a", time: "09:00" };
  assert.equal(overlaps(a, { ...a, id: "b", time: "09:30" }), true);
  assert.equal(overlaps(a, { ...a, id: "b", time: "10:00" }), false);
  assert.equal(overlaps(a, { ...a, id: "b", status: "rejected" }), false);
});
