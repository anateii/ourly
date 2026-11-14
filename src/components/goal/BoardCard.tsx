import { createElement, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  cardIcons,
  type CardEdits,
  type GoalCard,
} from "../../helpers/goalCards";
import GoalMenu from "../GoalMenu";
import NotesCard, { type NotesHandle } from "./NotesCard";
import ChecklistCard from "./ChecklistCard";
import ChartCard from "./ChartCard";
import CalendarCard from "./CalendarCard";
import PhotosCard from "./PhotosCard";
import JournalCard from "./JournalCard";

// One card on a goal's page: its head with a trash button and a ⋯ menu (edit, order) and
// the body for its kind. While `editing`, the title and content can change.
export default function BoardCard({
  card,
  editing,
  first,
  last,
  startDay,
  onToggleEdit,
  onUpdate,
  onMove,
  onRemove,
}: Readonly<{
  card: GoalCard;
  editing: boolean;
  first: boolean;
  last: boolean;
  startDay?: string; // the goal's target date, where a new calendar opens
  onToggleEdit: () => void;
  onUpdate: (edits: CardEdits) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}>) {
  const notes = useRef<NotesHandle>(null);
  const onData = (data: GoalCard["data"]) => onUpdate({ data });
  const name = card.title || "this card";

  return (
    <article
      className={`gb-card${editing ? " is-editing" : ""}`}
      aria-label={name}
    >
      <div className="gb-card-head">
        <span className="gb-type-icon" aria-hidden="true">
          {createElement(cardIcons[card.kind], { size: 20 })}
        </span>
        {editing ? (
          <input
            className="gb-input gb-title-input"
            aria-label="Card title"
            value={card.title}
            maxLength={60}
            onChange={(e) => onUpdate({ title: e.target.value })}
          />
        ) : (
          <h2>{card.title}</h2>
        )}
        {card.kind === "notes" && (
          <button
            type="button"
            className="icon-btn"
            aria-label={`Add a note to ${name}`}
            onClick={() => notes.current?.add()}
          >
            <Plus aria-hidden="true" size={20} />
          </button>
        )}
        {/* A notes card has no menu: each note has its own. */}
        {card.kind !== "notes" && (
          <GoalMenu
            label={`Options for ${name}`}
            actions={[
              {
                label: editing ? "Finish editing" : "Edit",
                onSelect: onToggleEdit,
              },
              {
                label: "Move earlier",
                onSelect: () => onMove(-1),
                disabled: first,
              },
              {
                label: "Move later",
                onSelect: () => onMove(1),
                disabled: last,
              },
            ]}
          />
        )}
        <button
          type="button"
          className="icon-btn"
          aria-label={`Remove ${name}`}
          onClick={onRemove}
        >
          <Trash2 aria-hidden="true" size={18} />
        </button>
      </div>

      {editing && (
        <div className="gb-toolbar">
          <span className="gb-small">
            Change the title and what is on the card.
          </span>
          <button
            type="button"
            className="gb-btn gb-btn-fill gb-push"
            onClick={onToggleEdit}
          >
            Done
          </button>
        </div>
      )}

      {card.kind === "notes" && (
        <NotesCard ref={notes} card={card} onData={onData} />
      )}
      {card.kind === "checklist" && (
        <ChecklistCard card={card} onData={onData} />
      )}
      {card.kind === "chart" && (
        <ChartCard card={card} editing={editing} onData={onData} />
      )}
      {card.kind === "calendar" && (
        <CalendarCard
          card={card}
          editing={editing}
          startDay={startDay}
          onData={onData}
        />
      )}
      {card.kind === "photos" && (
        <PhotosCard card={card} editing={editing} onData={onData} />
      )}
      {card.kind === "journal" && (
        <JournalCard card={card} editing={editing} onData={onData} />
      )}
    </article>
  );
}
