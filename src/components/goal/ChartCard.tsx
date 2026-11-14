import { X } from "lucide-react";
import { chartTotal, formatEuros, rowId, type CardOf, type ChartRow } from "../../helpers/goalCards";

const BAR_COLOURS = 5; // --viz-1 … --viz-5

export default function ChartCard({
  card,
  editing,
  onData,
}: Readonly<{
  card: CardOf<"chart">;
  editing: boolean;
  onData: (data: CardOf<"chart">["data"]) => void;
}>) {
  const { rows } = card.data;
  const max = Math.max(1, ...rows.map((r) => r.amount));
  const change = (id: string, edits: Partial<ChartRow>) =>
    onData({ rows: rows.map((r) => (r.id === id ? { ...r, ...edits } : r)) });

  return (
    <>
      <p className="gb-chart-top">
        <b>{formatEuros(chartTotal(rows))}</b>
        <span className="gb-small">planned in total</span>
      </p>
      {rows.length === 0 && !editing && (
        <p className="gb-small">No lines yet. Choose Edit in the card's menu to add one.</p>
      )}
      <ul className="gb-bars">
        {rows.map((r, i) => (
          <li key={r.id}>
            {editing ? (
              <div className="gb-bar-edit">
                <input
                  className="gb-input"
                  aria-label="Line name"
                  value={r.label}
                  maxLength={80}
                  onChange={(e) => change(r.id, { label: e.target.value })}
                />
                <input
                  className="gb-input gb-amount"
                  aria-label={`Amount for ${r.label || "this line"}, in euros`}
                  inputMode="numeric"
                  value={r.amount === 0 ? "" : String(r.amount)}
                  placeholder="0"
                  onChange={(e) =>
                    change(r.id, { amount: Number(e.target.value.replace(/\D/g, "").slice(0, 9)) })
                  }
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove ${r.label || "this line"}`}
                  onClick={() => onData({ rows: rows.filter((x) => x.id !== r.id) })}
                >
                  <X aria-hidden="true" size={16} />
                </button>
              </div>
            ) : (
              <div className="gb-bar-row">
                <span>{r.label}</span>
                <span>{formatEuros(r.amount)}</span>
              </div>
            )}
            <div className="gb-bar-track" aria-hidden="true">
              <div
                style={{
                  width: `${Math.max(2, (r.amount / max) * 100)}%`,
                  background: `var(--viz-${(i % BAR_COLOURS) + 1})`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
      {editing && (
        <div>
          <button
            type="button"
            className="gb-btn gb-btn-soft"
            onClick={() => onData({ rows: [...rows, { id: rowId(), label: "", amount: 0 }] })}
          >
            Add a line
          </button>
        </div>
      )}
    </>
  );
}
