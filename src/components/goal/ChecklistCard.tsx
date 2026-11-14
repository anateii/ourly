import { useId, type FormEvent } from "react";
import { X } from "lucide-react";
import { rowId, type CardOf } from "../../helpers/goalCards";

export default function ChecklistCard({
  card,
  onData,
}: Readonly<{ card: CardOf<"checklist">; onData: (data: CardOf<"checklist">["data"]) => void }>) {
  const id = useId();
  const { items } = card.data;
  const done = items.filter((i) => i.done).length;

  const add = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem("item") as HTMLInputElement;
    const text = input.value.trim();
    if (!text) return;
    onData({ items: [...items, { id: rowId(), text, done: false }] });
    input.value = "";
  };

  return (
    <>
      <div className="gb-progress">
        <span className="gb-meter" aria-hidden="true">
          <span style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
        </span>
        <p className="gb-small">
          {done} of {items.length} done
        </p>
      </div>
      {items.length > 0 && (
        <ul className="gb-checks">
          {items.map((item) => (
            <li key={item.id} className={item.done ? "is-done" : ""}>
              <input
                type="checkbox"
                id={`${id}-${item.id}`}
                checked={item.done}
                onChange={() =>
                  onData({ items: items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)) })
                }
              />
              <label htmlFor={`${id}-${item.id}`}>{item.text}</label>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove ${item.text}`}
                onClick={() => onData({ items: items.filter((i) => i.id !== item.id) })}
              >
                <X aria-hidden="true" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="gb-add-row" onSubmit={add}>
        <label className="sr-only" htmlFor={`${id}-new`}>
          New item
        </label>
        <input id={`${id}-new`} name="item" className="gb-input" placeholder="Add an item" maxLength={200} autoComplete="off" />
        <button type="submit" className="gb-btn gb-btn-soft">
          Add
        </button>
      </form>
    </>
  );
}
