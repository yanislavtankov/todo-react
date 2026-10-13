import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import bgLocale from "@fullcalendar/core/locales/bg";
import { STATUS, endOf } from "./domain.js";

// Календарът е производен изглед на същите задачи; няма собствена копия на данните.
export default function CalendarView({ tasks, onEdit, onCreate }) {
  const events = tasks.map((task) => ({
    id: task.id,
    title: `${task.title} · ${STATUS[task.status].label}`,
    start: `${task.date}T${task.time}:00`,
    end: endOf(task),
    backgroundColor: STATUS[task.status].color,
    borderColor: STATUS[task.status].color,
    extendedProps: { task },
  }));
  return (
    <section className="calendar-shell" aria-label="Календар на задачите">
      {/* Месечният преглед и седмичната времева ос показват начало и продължителност. */}
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        locale={bgLocale}
        initialView="dayGridMonth"
        firstDay={1}
        height="auto"
        events={events}
        nowIndicator
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        buttonText={{
          today: "Днес",
          month: "Месец",
          week: "Седмица",
          day: "Ден",
        }}
        eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        allDaySlot={false}
        slotMinTime="00:00:00"
        slotMaxTime="24:00:00"
        scrollTime="08:00:00"
        dayMaxEvents={3}
        eventClick={(info) => onEdit(info.event.extendedProps.task)}
        dateClick={(info) => onCreate(info.dateStr.slice(0, 10))}
      />
      <div className="calendar-legend">
        {Object.values(STATUS).map((s) => (
          <span key={s.label}>
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
        <span className="muted">Избери ден за нова задача</span>
      </div>
    </section>
  );
}
