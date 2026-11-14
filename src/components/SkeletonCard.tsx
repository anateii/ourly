// A card's outline while its content loads: an icon square, a title bar and
// `rows` content bars that pulse. `className` gives it the look of the card
// it stands in for (e.g. "card", "gb-card"), so nothing jumps when the real
// one arrives. Hidden from screen readers: pair it with a role="status" text.
export default function SkeletonCard({
  className = "card",
  rows = 3,
}: Readonly<{ className?: string; rows?: number }>) {
  return (
    <div className={`${className} skeleton`} aria-hidden="true">
      <div className="skeleton-head">
        <span className="bone bone-icon" />
        <span className="bone bone-title" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <span
          key={i}
          className={`bone bone-row${i === rows - 1 && rows > 1 ? " bone-short" : ""}`}
        />
      ))}
    </div>
  );
}
