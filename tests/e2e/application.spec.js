import { test, expect } from "@playwright/test";
import { dateKey } from "../../src/domain.js";

// Преди всеки сценарий се почиства само отделната тестова база през тестовия API.
test.beforeEach(async ({ request }) => {
  const tasks = await (
    await request.get("http://127.0.0.1:3002/api/tasks")
  ).json();
  for (const task of tasks)
    await request.delete(
      `http://127.0.0.1:3002/api/tasks/${task.id}?version=${task.version}`,
    );
});
async function add(page, title = "Подготовка на защита") {
  await page.getByRole("button", { name: "Нова задача", exact: true }).click();
  await page.getByLabel("Заглавие", { exact: true }).fill(title);
  await page.getByLabel("Описание").fill("Преглед на слайдовете");
  await page.getByLabel("Дата", { exact: true }).fill(dateKey());
  await page.getByLabel("Начален час").fill("10:00");
  await page.getByLabel("Продължителност (мин)").fill("90");
  await page.getByRole("button", { name: "Запази задача" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
test("Пълен цикъл: създаване, редакция, статус, календар, изтриване", async ({
  page,
}) => {
  await page.goto("/");
  await add(page);
  await expect(
    page.getByRole("heading", { name: "Подготовка на защита" }),
  ).toBeVisible();
  await page.getByLabel("Редактирай Подготовка на защита").click();
  await page.getByLabel("Заглавие", { exact: true }).fill("Защита на диплома");
  await page.getByRole("button", { name: "Запази задача" }).click();
  await page
    .getByLabel("Статус на Защита на диплома")
    .selectOption("in_progress");
  await expect(page.getByLabel("Статус на Защита на диплома")).toHaveValue(
    "in_progress",
  );
  await page
    .getByRole("button", { name: "Календар", exact: true })
    .first()
    .click();
  await expect(
    page.locator(".fc-event").filter({ hasText: "Защита на диплома" }),
  ).toBeVisible();
  await page
    .locator(".fc-event")
    .filter({ hasText: "Защита на диплома" })
    .click();
  await page.getByRole("button", { name: "Изтрий", exact: true }).click();
  await page.getByRole("button", { name: "Потвърди изтриването" }).click();
  await expect(page.locator(".fc-event")).toHaveCount(0);
});
test("Запазване след презареждане, Unicode търсене и филтри", async ({
  page,
}) => {
  await page.goto("/");
  await add(page, "Българска ЗАДАЧА");
  await page.reload();
  await page.getByLabel("Търсене на задачи").fill("българска");
  await expect(
    page.getByRole("heading", { name: "Българска ЗАДАЧА" }),
  ).toBeVisible();
  await page.getByLabel("Завърши Българска ЗАДАЧА").click();
  await page.getByRole("button", { name: /^Изпълнена/ }).click();
  await expect(
    page.getByRole("heading", { name: "Българска ЗАДАЧА" }),
  ).toBeVisible();
});
// Демонстрационните екранни снимки използват единствено изолираните тестови записи.
test("Визуални изгледи на списъка, календара и телефона", async ({
  page,
  request,
}) => {
  const titles = [
    "Подготовка на дипломната защита",
    "Разработка на календарния изглед",
    "Преглед на литературните източници",
  ];
  for (let i = 0; i < titles.length; i++)
    await request.post("http://127.0.0.1:3002/api/tasks", {
      data: {
        title: titles[i],
        description: [
          "Преглед на презентацията и финални бележки",
          "Седмичен график, часове и статус на задачите",
          "Проверка на цитатите и библиографията",
        ][i],
        date: dateKey(),
        time: ["09:00", "11:00", "14:00"][i],
        duration: [60, 90, 45][i],
        status: ["completed", "in_progress", "planned"][i],
      },
    });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: titles[0] })).toBeVisible();
  await page.screenshot({
    path: "docs/images/tasks-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Календар", exact: true })
    .first()
    .click();
  await expect(page.locator(".fc-event")).toHaveCount(3);
  await page.screenshot({
    path: "docs/images/calendar-month.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Седмица", exact: true }).click();
  await expect(page.locator(".fc-timegrid")).toBeVisible();
  await page.screenshot({
    path: "docs/images/calendar-week.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Списък", exact: true }).click();
  await page.screenshot({
    path: "docs/images/tasks-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("Клавиатурно затваряне и липса на хоризонтално преливане на телефон", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await add(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Редактирай Подготовка на защита").click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("Показва мрежова грешка и запазва черновата във формуляра", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Нова задача", exact: true }).click();
  await page.getByLabel("Заглавие", { exact: true }).fill("Неуспешен запис");
  await page.route("**/api/tasks", (route) => route.abort());
  await page.getByRole("button", { name: "Запази задача" }).click();
  await expect(page.getByRole("alert")).toContainText("Няма връзка");
  await expect(page.getByLabel("Заглавие", { exact: true })).toHaveValue(
    "Неуспешен запис",
  );
});
// Регресионният сценарий възпроизвежда HTML от чужда услуга вместо API JSON.
test("Обяснява неочакван HTML отговор без грешка от JSON парсера", async ({ page }) => {
  await page.route("**/api/tasks", route => route.fulfill({ status: 200, contentType: "text/html", body: "<!DOCTYPE html><html>Друга услуга</html>" }));
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("API не връща JSON");
});

