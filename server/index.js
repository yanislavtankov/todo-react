import { resolve } from "node:path";
import { openDatabase } from "./database.js";
import { createApp } from "./app.js";

// По подразбиране услугата е достъпна само от текущия компютър.
const db = openDatabase(resolve(process.env.DB_PATH || "data/tasks.sqlite"));
const server = createApp(db).listen(
  Number(process.env.PORT || 4317),
  "127.0.0.1",
  () => {
    console.log("Ден по ден: http://127.0.0.1:" + (process.env.PORT || 4317));
  },
);
// Заетият порт се съобщава ясно и процесът не се представя като успешно стартиран.
server.on("error", (error) => {
  console.error("Локалният сървър не стартира:", error.message);
  db.close();
  process.exit(1);
});
// Коректното затваряне освобождава файловете и приключва текущите заявки.
function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
