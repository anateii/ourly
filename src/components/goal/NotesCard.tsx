import { useImperativeHandle, useRef, useState, type Ref } from "react";
import { rowId, type CardOf, type Note } from "../../helpers/goalCards";
import GoalMenu from "../GoalMenu";
import NoteDialog from "./NoteDialog";

// What the card's head can ask for: its "+" opens the dialog for a new note.
export interface NotesHandle {
  add: () => void;
}

// A list of short notes. Adding and editing happen in a dialog.
export default function NotesCard({
  card,
  onData,
  ref,
}: Readonly<{
  card: CardOf<"notes">;
  onData: (data: CardOf<"notes">["data"]) => void;
  ref?: Ref<NotesHandle>;
}>) {
  const { notes } = card.data;
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<Note | null>(null); // null = a new note

  const show = (note: Note | null) => {
    setOpen(note);
    dialog.current?.showModal();
  };
  useImperativeHandle(ref, () => ({ add: () => show(null) }));

  const save = (title: string, text: string) =>
    onData({
      notes: open
        ? notes.map((n) => (n.id === open.id ? { ...n, title, text } : n))
        : [...notes, { id: rowId(), title, text }],
    });

  return (
    <>
      {notes.length === 0 ? (
        <p className="gb-small">No notes yet. Use the + to add the first one.</p>
      ) : (
        <ul className="gb-note-list">
          {notes.map((note) => (
            <li key={note.id} className="gb-note">
              <button type="button" className="gb-note-open" onClick={() => show(note)}>
                <span className="gb-note-title">{note.title}</span>
                <span className="gb-note-text">{note.text || "–"}</span>
              </button>
              <GoalMenu
                label={`Options for ${note.title}`}
                actions={[
                  { label: "Edit", onSelect: () => show(note) },
                  {
                    label: "Delete",
                    onSelect: () => onData({ notes: notes.filter((n) => n.id !== note.id) }),
                  },
                ]}
              />
            </li>
          ))}
        </ul>
      )}
      <NoteDialog ref={dialog} note={open} onSave={save} />
    </>
  );
}
