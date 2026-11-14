import { useEffect, useRef, useState } from "react";
import { useApi } from "../../helpers/api";
import type { CardEdits, CardKind, GoalCard } from "../../helpers/goalCards";

// How long to wait after the last keystroke before a card saves.
const SAVE_MS = 600;
// How long a removed card can be brought back; the same as the app's Undo toast.
const UNDO_MS = 5000;

export type Notify = (t: {
  message: string;
  ok: boolean;
  undo?: () => void;
}) => void;

// One goal's cards: loads them, shows every change at once and saves it in
// the background. Typing saves once it pauses, not on every key.
// Mount it per goal (give the page a `key`), so each goal starts clean.
export function useGoalCards(goalId: string, notify: Notify) {
  const api = useApi();
  const [cards, setCards] = useState<GoalCard[] | null>(null); // null = loading
  const [problem, setProblem] = useState<"load" | "save" | null>(null);

  // Always the newest `api`, for timers and cleanup that outlive a render.
  const apiRef = useRef(api);
  useEffect(() => {
    apiRef.current = api;
  });

  useEffect(() => {
    let current = true;
    apiRef
      .current<{ cards: GoalCard[] }>(
        `/goals?cards=${encodeURIComponent(goalId)}`,
      )
      .then(
        (res) =>
          current &&
          // A card added before the list arrived stays, after the loaded ones.
          setCards((cs) => [
            ...res.cards,
            ...(cs ?? []).filter((c) => !res.cards.some((r) => r.id === c.id)),
          ]),
      )
      .catch(() => current && setProblem("load"));
    return () => {
      current = false;
    };
  }, [goalId]);

  const failed = (err: unknown) => {
    console.error("Saving card failed:", err);
    setProblem("save");
  };

  // Edits waiting for their pause, by card id.
  const waiting = useRef(
    new Map<
      string,
      { edits: CardEdits; timer: ReturnType<typeof setTimeout> }
    >(),
  );
  const saveNow = (id: string) => {
    const w = waiting.current.get(id);
    if (!w) return;
    clearTimeout(w.timer);
    waiting.current.delete(id);
    const { title, ...rest } = w.edits;
    // A title being retyped can be empty for a moment; the stored one stays.
    const edits = title?.trim() ? { ...rest, title } : rest;
    if (!Object.keys(edits).length) return;
    apiRef
      .current("/goals", {
        method: "PATCH",
        body: JSON.stringify({ type: "card", id, ...edits }),
      })
      .then(() => setProblem(null))
      .catch(failed);
  };
  // Removed cards inside their Undo window, by card id: each deletes when run.
  const removing = useRef(new Map<string, () => void>());
  // Leaving the page: save what is still waiting, delete what was removed.
  useEffect(() => {
    const pending = waiting.current;
    const removed = removing.current;
    return () => {
      for (const id of [...pending.keys()]) saveNow(id);
      for (const run of [...removed.values()]) run();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- saveNow only reads refs
  }, []);

  const update = (id: string, edits: CardEdits) => {
    setCards(
      (cs) =>
        cs &&
        cs.map((c) => (c.id === id ? ({ ...c, ...edits } as GoalCard) : c)),
    );
    const before = waiting.current.get(id);
    if (before) clearTimeout(before.timer);
    waiting.current.set(id, {
      edits: { ...before?.edits, ...edits },
      timer: setTimeout(() => saveNow(id), SAVE_MS),
    });
  };

  // Resolves with the new card's id, or null when it couldn't be added.
  const add = (kind: CardKind) =>
    api<{ card: GoalCard }>("/goals", {
      method: "POST",
      body: JSON.stringify({ type: "card", goalId, kind }),
    })
      .then(({ card }) => {
        setCards((cs) => [...(cs ?? []), card]);
        setProblem(null);
        return card.id;
      })
      .catch((err) => {
        failed(err);
        return null;
      });

  // Hide it now and delete it once the Undo window has passed.
  const remove = (id: string) => {
    const at = cards?.findIndex((c) => c.id === id) ?? -1;
    const card = cards?.[at];
    if (!card) return;
    saveNow(id); // a last edit still reaches the server, so Undo brings it back
    setCards((cs) => cs && cs.filter((c) => c.id !== id));
    const timer = setTimeout(() => run(), UNDO_MS);
    const run = () => {
      clearTimeout(timer);
      removing.current.delete(id);
      apiRef
        .current(`/goals?card=${encodeURIComponent(id)}`, { method: "DELETE" })
        .catch(failed);
    };
    removing.current.set(id, run);
    notify({
      message: `Removed “${card.title}”`,
      ok: true,
      undo: () => {
        if (!removing.current.delete(id)) return; // already deleted
        clearTimeout(timer);
        setCards((cs) => {
          if (!cs || cs.some((c) => c.id === id)) return cs;
          const next = [...cs];
          next.splice(Math.min(at, next.length), 0, card);
          return next;
        });
      },
    });
  };

  // Move a card one place earlier (-1) or later (1).
  const move = (id: string, by: -1 | 1) => {
    if (!cards) return;
    const from = cards.findIndex((c) => c.id === id);
    const to = from + by;
    if (from < 0 || to < 0 || to >= cards.length) return;
    const next = [...cards];
    [next[from], next[to]] = [next[to], next[from]];
    setCards(next);
    api("/goals", {
      method: "PATCH",
      body: JSON.stringify({
        type: "card-order",
        goalId,
        order: next.map((c) => c.id),
      }),
    }).catch(failed);
  };

  return { cards, problem, update, add, remove, move };
}
