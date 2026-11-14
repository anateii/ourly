import {
  BookOpen,
  CalendarDays,
  ChartNoAxesColumn,
  FileText,
  Images,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import type { GoalCategory, GoalTint } from "../types";

// The cards on a goal's own page, as GET /api/goals?cards=<goalId> returns
// them (see cardToClient() in api/goals.ts). `data` depends on the kind.
export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}
export interface Note {
  id: string;
  title: string;
  text: string;
}
export interface ChartRow {
  id: string;
  label: string;
  amount: number; // whole euros
}
export interface CardEvent {
  day: string; // "YYYY-MM-DD"
  label: string;
}
export interface CardPhoto {
  id: string;
  url: string; // from POST /api/photos
  caption: string;
}
export interface JournalEntry {
  id: string;
  at: string; // ISO time it was written
  text: string;
}

interface CardBase {
  id: string;
  goalId: string;
  title: string;
}
export type GoalCard = CardBase &
  (
    | { kind: "notes"; data: { notes: Note[] } }
    | { kind: "checklist"; data: { items: ChecklistItem[] } }
    | { kind: "chart"; data: { rows: ChartRow[] } }
    | { kind: "calendar"; data: { events: CardEvent[] } }
    | { kind: "photos"; data: { photos: CardPhoto[] } }
    | { kind: "journal"; data: { entries: JournalEntry[] } }
  );
export type CardKind = GoalCard["kind"];
// One kind of card, e.g. CardOf<"chart">, for the component that draws it.
export type CardOf<K extends CardKind> = Extract<GoalCard, { kind: K }>;
// What can change on a card. `data` must be the shape for the card's kind.
export type CardEdits = Partial<Pick<GoalCard, "title">> & { data?: GoalCard["data"] };

export const cardFormats: { kind: CardKind; label: string; hint: string; icon: LucideIcon }[] = [
  { kind: "notes", label: "Notes", hint: "Short notes: an itinerary, ideas, addresses", icon: FileText },
  { kind: "checklist", label: "Checklist", hint: "Things to do or book, ticked off together", icon: ListChecks },
  { kind: "chart", label: "Chart", hint: "Costs or amounts as bars", icon: ChartNoAxesColumn },
  { kind: "calendar", label: "Calendar", hint: "Key dates on a month", icon: CalendarDays },
  { kind: "photos", label: "Photo album", hint: "Pictures and inspiration", icon: Images },
  { kind: "journal", label: "Journal", hint: "Dated entries as you go", icon: BookOpen },
];
export const cardIcons = Object.fromEntries(cardFormats.map((f) => [f.kind, f.icon])) as Record<
  CardKind,
  LucideIcon
>;

// The banner's colour for a goal that has no photo.
export const categoryTint: Record<GoalCategory, GoalTint> = {
  Travel: "sky",
  Home: "peach",
  Career: "plum",
  Finance: "amber",
  Life: "sage",
};

// Short ids for rows inside a card (checklist items, chart lines, …).
export const rowId = () => crypto.randomUUID().slice(0, 8);

const euros = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
export const formatEuros = (amount: number) => euros.format(amount);
export const chartTotal = (rows: readonly ChartRow[]) => rows.reduce((sum, r) => sum + r.amount, 0);

// The banner's numbers: how many cards, checklist items ticked, money planned.
export const boardStats = (cards: readonly GoalCard[]) => {
  let done = 0;
  let total = 0;
  let planned = 0;
  for (const c of cards) {
    if (c.kind === "checklist") {
      total += c.data.items.length;
      done += c.data.items.filter((i) => i.done).length;
    }
    if (c.kind === "chart") planned += chartTotal(c.data.rows);
  }
  return { cards: cards.length, done, total, planned };
};

// "YYYY-MM-DD" for a local date.
export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// The days of a month as a Monday-first grid: null for the blanks before the 1st.
export const monthCells = (year: number, month: number): (Date | null)[] => {
  const blanks = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  return [
    ...Array.from({ length: blanks }, () => null),
    ...Array.from({ length: days }, (_, i) => new Date(year, month, i + 1)),
  ];
};
