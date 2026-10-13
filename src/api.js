// Единната функция обработва мрежовите и бизнес грешките на всички операции.
export async function request(path = "", options = {}) {
  let response;
  try {
    response = await fetch(`/api/tasks${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch {
    throw new Error(
      "Няма връзка с приложението. Провери дали локалният сървър работи.",
    );
  }
  // HTML от грешна услуга не се подава на JSON парсера като валиден API отговор.
  if (response.status !== 204 && !response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("API не връща JSON. Провери връзката към локалния сървър на порт 4317.");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(
      body.error || "Операцията не може да бъде изпълнена.",
    );
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}
