import { useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { dayKey, monthCells, type CardOf } from "../../helpers/goalCards";
import { parseDay } from "../../helpers/goals";

const monthYear = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const dayLong = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" });
const dayShort = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

// A month where each day can hold one plan. It opens on the first plan's
// month, else the goal's target month (`startDay`), else this month.
export default function CalendarCard({
  card,
  editing,
  startDay,
  onData,
}: Readonly<{
  card: CardOf<"calendar">;
  editing: boolean;
  startDay?: string; // "YYYY-MM-DD"
  onData: (data: CardOf<"calendar">["data"]) => void;
}>) {
  const events = [...card.data.events].sort((a, b) => a.day.localeCompare(b.day));
  const [cursor, setCursor] = useState(() => {
    const first = events[0]?.day ?? startDay;
    const d = first ? parseDay(first) : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const shift = (by: number) =>
    setCursor(({ year, month }) => {
      const d = new Date(year, month + by, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const toggle = (day: string) =>
    onData({
      events: events.some((e) => e.day === day)
        ? events.filter((e) => e.day !== day)
        : [...events, { day, label: "New plan" }],
    });

  return (
    <>
      <div className="gb-cal-head">
        <p aria-live="polite">{monthYear.format(new Date(cursor.year, cursor.month, 1))}</p>
        <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => shift(-1)}>
          <ChevronLeft aria-hidden="true" size={18} />
        </button>
        <button type="button" className="icon-btn" aria-label="Next month" onClick={() => shift(1)}>
          <ChevronRight aria-hidden="true" size={18} />
        </button>
      </div>
      <div className="gb-cal-grid">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="gb-cal-wk" aria-hidden="true">
            {w}
          </span>
        ))}
        {monthCells(cursor.year, cursor.month).map((date, i) => {
          if (!date) return <span key={`blank-${i}`} />;
          const day = dayKey(date);
          const plan = events.find((e) => e.day === day);
          return (
            <button
              key={day}
              type="button"
              className={`gb-cal-day${plan ? " has-plan" : ""}`}
              aria-pressed={!!plan}
              aria-label={`${dayLong.format(date)}${plan ? `: ${plan.label}` : ""}`}
              onClick={() => toggle(day)}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
      {events.length > 0 && (
        <ul className="gb-events">
          {events.map((ev) => (
            <li key={ev.day}>
              <time className="gb-event-day" dateTime={ev.day}>
                {dayShort.format(parseDay(ev.day))}
              </time>
              {editing ? (
                <>
                  <input
                    className="gb-input"
                    aria-label={`Plan on ${dayLong.format(parseDay(ev.day))}`}
                    value={ev.label}
                    maxLength={120}
                    onChange={(e) =>
                      onData({
                        events: events.map((x) => (x.day === ev.day ? { ...x, label: e.target.value } : x)),
                      })
                    }
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Remove the plan on ${dayLong.format(parseDay(ev.day))}`}
                    onClick={() => toggle(ev.day)}
                  >
                    <X aria-hidden="true" size={16} />
                  </button>
                </>
              ) : (
                <span>{ev.label}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="gb-small">
        Tap a day to add or remove a plan. Choose Edit in the card's menu to name your plans.
      </p>
    </>
  );
}
