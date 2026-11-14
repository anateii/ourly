import type { Person } from "../types";
import { usePeople } from "../helpers/people";
import { smoothly } from "../helpers/motion";
import Avatars from "./Avatars";

export type Who = "all" | Person;

// The "whose is it" tabs, the same wherever they appear: All, Mine, the
// partner's name (once there is one), then Shared where things can belong to
// both. `compact` is the small size used inside Home cards.
export default function WhoFilter({
  value,
  onChange,
  me,
  label,
  shared = true,
  count,
  compact = false,
}: Readonly<{
  value: Who;
  onChange: (who: Who) => void;
  me: Person;
  label: string;
  shared?: boolean;
  count?: (who: Who) => number;
  compact?: boolean;
}>) {
  const { name, partner } = usePeople();
  const other: Person = me === "partner" ? "owner" : "partner";

  const options: { key: Who; label: string }[] = [
    { key: "all", label: "All" },
    { key: me, label: "Mine" },
    ...(partner ? [{ key: other, label: name(other) }] : []),
    ...(shared ? [{ key: "Both" as Who, label: "Shared" }] : []),
  ];

  return (
    <div className={`${compact ? "mini-seg" : "segmented"} who-filter`} aria-label={label}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={o.key === value}
          className={o.key === value ? "active" : ""}
          onClick={() => smoothly(() => onChange(o.key))}
        >
          {o.key !== "all" && <Avatars owner={o.key} />}
          {/* One span, so the count shares the label's line (the button
              centres each flex item on its own, which lifts the smaller count) */}
          <span>
            {o.label}
            {count && <> <span className="seg-count">{count(o.key)}</span></>}
          </span>
        </button>
      ))}
    </div>
  );
}
