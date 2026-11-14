import { forwardRef, useState } from "react";
import type { Note } from "../../helpers/goalCards";
import { closeRef, useSession } from "../../helpers/dialogs";
import { CloseButton, FieldError } from "../dialogParts";

// Adds a note to a notes card, or edits `note` when one is passed.
const NoteDialog = forwardRef<
  HTMLDialogElement,
  { note: Note | null; onSave: (title: string, text: string) => void }
>(function NoteDialog({ note, onSave }, ref) {
  const [error, setError] = useState(false);
  const [session, nextSession] = useSession();

  const submit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    setError(!title);
    if (!title) {
      e.currentTarget.querySelector<HTMLElement>("#note-title")?.focus();
      return;
    }
    onSave(title, String(data.get("text") ?? "").trim());
    closeRef(ref);
  };

  return (
    <dialog
      ref={ref}
      className="dialog note-dialog"
      aria-labelledby="note-dialog-title"
      // No click-outside-to-close: a stray click shouldn't lose what was typed.
      onClose={() => {
        setError(false);
        nextSession();
      }}
    >
      <form key={`${note?.id ?? "new"}-${session}`} onSubmit={submit} noValidate>
        <div className="dialog-head">
          <h2 id="note-dialog-title">{note ? "Edit note" : "New note"}</h2>
          <CloseButton dialog={ref} />
        </div>

        <div className="field">
          <label htmlFor="note-title">Title</label>
          <input
            id="note-title"
            name="title"
            type="text"
            maxLength={120}
            autoComplete="off"
            defaultValue={note?.title}
            placeholder="e.g. Places to eat"
            aria-invalid={error || undefined}
            aria-describedby={error ? "note-title-error" : undefined}
          />
          {error && <FieldError id="note-title-error">Give the note a title.</FieldError>}
        </div>

        <div className="field">
          <label htmlFor="note-text">Text</label>
          <textarea
            id="note-text"
            name="text"
            maxLength={20000}
            rows={7}
            defaultValue={note?.text}
            placeholder="Plans, ideas, addresses…"
          />
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn-secondary" onClick={() => closeRef(ref)}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            {note ? "Save changes" : "Add note"}
          </button>
        </div>
      </form>
    </dialog>
  );
});

export default NoteDialog;
