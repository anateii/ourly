import { useId, type FormEvent } from "react";
import { X } from "lucide-react";
import { rowId, type CardOf } from "../../helpers/goalCards";

const when = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });

export default function JournalCard({
  card,
  editing,
  onData,
}: Readonly<{
  card: CardOf<"journal">;
  editing: boolean;
  onData: (data: CardOf<"journal">["data"]) => void;
}>) {
  const id = useId();
  const { entries } = card.data;

  const add = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem("entry") as HTMLInputElement;
    const text = input.value.trim();
    if (!text) return;
    onData({ entries: [...entries, { id: rowId(), at: new Date().toISOString(), text }] });
    input.value = "";
  };

  return (
    <>
      <form className="gb-add-row" onSubmit={add}>
        <label className="sr-only" htmlFor={id}>
          New entry
        </label>
        <input id={id} name="entry" className="gb-input" placeholder="How did today go?" maxLength={2000} autoComplete="off" />
        <button type="submit" className="gb-btn gb-btn-soft">
          Save
        </button>
      </form>
      {entries.length === 0 ? (
        <p className="gb-small">No entries yet.</p>
      ) : (
        <ul className="gb-entries">
          {/* Newest first */}
          {[...entries].reverse().map((entry) => (
            <li key={entry.id}>
              <div>
                <time className="gb-entry-date" dateTime={entry.at}>
                  {when.format(new Date(entry.at))}
                </time>
                <p>{entry.text}</p>
              </div>
              {editing && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove the entry from ${when.format(new Date(entry.at))}`}
                  onClick={() => onData({ entries: entries.filter((x) => x.id !== entry.id) })}
                >
                  <X aria-hidden="true" size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
