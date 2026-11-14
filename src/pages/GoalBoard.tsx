import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import type { Goal } from "../types";
import { daysUntil, parseDay } from "../helpers/goals";
import {
  boardStats,
  categoryTint,
  formatEuros,
  type CardKind,
} from "../helpers/goalCards";
import { smoothly } from "../helpers/motion";
import { useGoalCards, type Notify } from "../components/goal/useGoalCards";
import BoardCard from "../components/goal/BoardCard";
import CreateCard from "../components/goal/CreateCard";
import SkeletonCard from "../components/SkeletonCard";
import "./GoalBoard.css";

const monthYear = new Intl.DateTimeFormat(undefined, {
  month: "long",
  year: "numeric",
});

// "90 days to go", "Tomorrow", "Today", "12 days ago"
const countdown = (day: string) => {
  const d = daysUntil(day);
  if (d > 1) return `${d} days to go`;
  if (d === 1) return "Tomorrow";
  if (d === 0) return "Today";
  return d === -1 ? "Yesterday" : `${-d} days ago`;
};

// One goal's own page (#goals/<id>): a banner with the goal's photo, then the
// couple's cards, two per row. "Create a card" has the row above them.
// Give it `key={goal.id}`.
export default function GoalBoard({
  goal,
  notify,
}: Readonly<{ goal: Goal; notify: Notify }>) {
  const { cards, problem, update, add, remove, move } = useGoalCards(
    goal.id,
    notify,
  );
  const [editing, setEditing] = useState<string | null>(null); // card id
  const [picking, setPicking] = useState(false);
  const [adding, setAdding] = useState(false);

  const stats = boardStats(cards ?? []);

  const pick = async (kind: CardKind) => {
    setAdding(true);
    const id = await add(kind);
    setAdding(false);
    if (!id) return;
    // The new card opens in edit mode, ready to be named. A notes card has none.
    smoothly(() => {
      setPicking(false);
      setEditing(kind === "notes" ? null : id);
    });
    document
      .getElementById(`gb-${id}`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  return (
    <div className="gb">
      <div>
        <a className="gb-btn gb-btn-line" href="#goals">
          <ChevronLeft aria-hidden="true" size={18} />
          All goals
        </a>
      </div>

      {/* The goal's photo, or its category colour until it has one */}
      <section
        className={`gb-banner gb-tint-${categoryTint[goal.category]}${goal.image ? " has-photo" : ""}`}
        aria-labelledby="page-title"
      >
        {goal.image ? (
          <img
            className="gb-banner-photo"
            src={goal.image}
            alt=""
            width={1600}
            height={900}
          />
        ) : (
          <span className="gb-ring" aria-hidden="true" />
        )}
        <div className="gb-banner-text">
          <p className="gb-eyebrow">{goal.category} goal</p>
          <h1 id="page-title" tabIndex={-1}>
            {goal.title}
          </h1>
          {goal.targetDate && (
            <p className="gb-lead">
              <time dateTime={goal.targetDate}>
                {monthYear.format(parseDay(goal.targetDate))}
              </time>
              {" · "}
              {countdown(goal.targetDate)}
            </p>
          )}
        </div>
        <div className="gb-banner-side">
          <dl className="gb-stats">
            <div>
              <dt>{stats.cards === 1 ? "card" : "cards"}</dt>
              <dd>{stats.cards}</dd>
            </div>
            <div>
              <dt>ticked off</dt>
              <dd>
                {stats.done}/{stats.total}
              </dd>
            </div>
            <div>
              <dt>planned</dt>
              <dd>{formatEuros(stats.planned)}</dd>
            </div>
          </dl>
        </div>
      </section>

      {problem && (
        <p className="gb-error" role="alert">
          {problem === "load"
            ? "We couldn't load this goal's cards. Check your connection and reload the page."
            : "Your last change didn't save. Check your connection and try again."}
        </p>
      )}

      {/* The tile shows at once; the cards join it when they have loaded. */}
      <div className="gb-board">
        <CreateCard
          open={picking}
          adding={adding}
          onOpen={() =>
            smoothly(() => {
              setPicking(true);
              setEditing(null);
            })
          }
          onClose={() => smoothly(() => setPicking(false))}
          onPick={(kind) => void pick(kind)}
        />
        {cards?.map((card, i) => (
          <div key={card.id} id={`gb-${card.id}`} className="gb-cell">
            <BoardCard
              card={card}
              editing={editing === card.id}
              first={i === 0}
              last={i === cards.length - 1}
              startDay={goal.targetDate}
              onToggleEdit={() =>
                smoothly(() => setEditing(editing === card.id ? null : card.id))
              }
              onUpdate={(edits) => update(card.id, edits)}
              onMove={(by) => smoothly(() => move(card.id, by))}
              onRemove={() =>
                smoothly(() => {
                  setEditing(null);
                  remove(card.id);
                })
              }
            />
          </div>
        ))}
        {/* Loading: two card outlines hold the place of the real ones. */}
        {!cards &&
          !problem &&
          [0, 1].map((i) => <SkeletonCard key={i} className="gb-card" />)}
      </div>
      {!cards && !problem && (
        <p className="sr-only" role="status">
          Loading your cards…
        </p>
      )}
    </div>
  );
}
