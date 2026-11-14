import { createElement } from "react";
import { LoaderCircle, Plus, X } from "lucide-react";
import { cardFormats, type CardKind } from "../../helpers/goalCards";

// The first tile on a goal's page. It opens in place into the list of card
// formats; picking one adds that card after the others.
export default function CreateCard({
  open,
  adding,
  onOpen,
  onClose,
  onPick,
}: Readonly<{
  open: boolean;
  adding: boolean; // a picked card is being created
  onOpen: () => void;
  onClose: () => void;
  onPick: (kind: CardKind) => void;
}>) {
  if (!open)
    return (
      <button type="button" className="gb-create" onClick={onOpen}>
        <span className="gb-create-plus" aria-hidden="true">
          <Plus size={22} strokeWidth={2.2} />
        </span>
        <b>Create a card</b>
        <span className="gb-small">Notes, checklist, chart, calendar, photos or journal</span>
      </button>
    );

  return (
    <section className="gb-card gb-picker" aria-labelledby="gb-pick-title" aria-busy={adding}>
      <div className="gb-card-head">
        <h2 id="gb-pick-title">Pick a format</h2>
        {adding && <LoaderCircle aria-hidden="true" size={18} className="spin" />}
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
          <X aria-hidden="true" size={18} />
        </button>
      </div>
      <div className="gb-formats">
        {cardFormats.map((f) => (
          <button
            key={f.kind}
            type="button"
            className="gb-format"
            disabled={adding}
            onClick={() => onPick(f.kind)}
          >
            <span className="gb-type-icon" aria-hidden="true">
              {createElement(f.icon, { size: 20 })}
            </span>
            <b>{f.label}</b>
            <span>{f.hint}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
