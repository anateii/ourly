import { and, asc, eq, max, sql, type SQL } from "drizzle-orm";
import { del } from "@vercel/blob";
import { isSpacePhoto, photoPath, photoUrl } from "./_lib/photos.js";
import { db } from "../db/client.js";
import { goalCards, goals, goalCategoryEnum } from "../db/schema.js";
import { getUserId, json } from "./_lib/auth.js";
import { getMembership, isMember } from "./_lib/space.js";
import { logActivity } from "./_lib/activity.js";

type Category = (typeof goalCategoryEnum.enumValues)[number];
const isCategory = (v: unknown): v is Category =>
  goalCategoryEnum.enumValues.includes(v as Category);

// "YYYY-MM-DD" that is a real calendar day.
const isDay = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);

// imageUrl from the client -> the Blob pathname to store, or an error.
// Must be a /api/photos URL (from POST /api/photos) for this space's folder, so a
// goal can't point at arbitrary hosts or another space's files.
const parseImage = (v: unknown, spaceId: string): { path: string | null } | { error: string } => {
  if (v === null) return { path: null };
  const path = typeof v === "string" ? photoPath(v) : null;
  return isSpacePhoto(path, spaceId)
    ? { path }
    : { error: "imageUrl must be a photo uploaded with /api/photos, or null" };
};

const toClient = (g: typeof goals.$inferSelect) => ({
  id: g.id,
  title: g.name,
  subtitle: g.subtitle,
  category: g.category,
  ownerUserId: g.ownerUserId, // null = both of you
  stepsDone: g.stepsDone,
  stepsTotal: g.stepsTotal,
  nextStep: g.nextStep,
  image: g.imageUrl && photoUrl(g.imageUrl), // stored as a private Blob pathname
  targetDate: g.targetDate,
  savedCents: g.savedCents,
  targetCents: g.targetCents,
  featured: g.featured,
});

/* Goal cards: the cards on a goal's own page. They share this endpoint (the
   Vercel Hobby plan allows 12 functions):
     GET    /api/goals?cards=<goalId>                       list a goal's cards
     POST   { type: "card", goalId, kind }                  add one
     PATCH  { type: "card", id, title?, data? }             change one
     PATCH  { type: "card-order", goalId, order: [id, …] }  reorder
     DELETE /api/goals?card=<id>                            remove one        */

const KINDS = ["notes", "checklist", "chart", "calendar", "photos", "journal"] as const;
type Kind = (typeof KINDS)[number];
const isKind = (v: unknown): v is Kind => KINDS.includes(v as Kind);

const kindTitles: Record<Kind, string> = {
  notes: "Notes",
  checklist: "Checklist",
  chart: "Chart",
  calendar: "Calendar",
  photos: "Photo album",
  journal: "Journal",
};
const emptyData: Record<Kind, object> = {
  notes: { notes: [] },
  checklist: { items: [] },
  chart: { rows: [] },
  calendar: { events: [] },
  photos: { photos: [] },
  journal: { entries: [] },
};
const MAX_CARDS = 24; // per goal
const MAX_ROWS = 200; // per list inside a card

type Row = Record<string, unknown>;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
// A list from the client: objects only, capped, each mapped (null drops it).
const rows = <T>(v: unknown, map: (r: Row) => T | null): T[] =>
  (Array.isArray(v) ? v : [])
    .slice(0, MAX_ROWS)
    .filter((r): r is Row => !!r && typeof r === "object")
    .map(map)
    .filter((r): r is T => r !== null);
const rowId = (r: Row) => text(r.id, 40) || crypto.randomUUID();

// A card's `data` from the client -> exactly the shape for its kind. Unknown
// fields are dropped. Photos are stored as Blob pathnames, like a goal's photo.
const cleanData = (kind: Kind, raw: unknown, spaceId: string): object => {
  const d: Row = raw && typeof raw === "object" ? (raw as Row) : {};
  switch (kind) {
    case "notes":
      return {
        notes: rows(d.notes, (r) => {
          const title = text(r.title, 120).trim();
          return title ? { id: rowId(r), title, text: text(r.text, 20_000) } : null;
        }),
      };
    case "checklist":
      return {
        items: rows(d.items, (r) => {
          const label = text(r.text, 200).trim();
          return label ? { id: rowId(r), text: label, done: r.done === true } : null;
        }),
      };
    case "chart":
      return {
        rows: rows(d.rows, (r) => ({
          id: rowId(r),
          label: text(r.label, 80),
          amount:
            typeof r.amount === "number" && Number.isFinite(r.amount)
              ? Math.min(Math.max(Math.round(r.amount), 0), 100_000_000)
              : 0,
        })),
      };
    case "calendar":
      return {
        events: rows(d.events, (r) =>
          isDay(r.day) ? { day: r.day, label: text(r.label, 120) } : null,
        ),
      };
    case "photos":
      return {
        photos: rows(d.photos, (r) => {
          const path = typeof r.url === "string" ? photoPath(r.url) : null;
          return isSpacePhoto(path, spaceId)
            ? { id: rowId(r), path, caption: text(r.caption, 120) }
            : null;
        }),
      };
    case "journal":
      return {
        entries: rows(d.entries, (r) => {
          const body = text(r.text, 2000).trim();
          const at = typeof r.at === "string" && !Number.isNaN(Date.parse(r.at)) ? r.at : null;
          return body && at ? { id: rowId(r), at, text: body } : null;
        }),
      };
  }
};

type StoredPhoto = { id: string; path: string; caption: string };
const photosOf = (c: Pick<typeof goalCards.$inferSelect, "kind" | "data">): StoredPhoto[] =>
  c.kind === "photos" ? ((c.data as { photos?: StoredPhoto[] }).photos ?? []) : [];

// A notes card's notes. The first notes cards held one free text: it becomes
// their first note.
const notesOf = (data: unknown) => {
  const d = (data ?? {}) as { notes?: unknown; text?: unknown };
  if (Array.isArray(d.notes)) return d.notes;
  return typeof d.text === "string" && d.text.trim()
    ? [{ id: "first", title: "Notes", text: d.text }]
    : [];
};

const cardToClient = (c: typeof goalCards.$inferSelect) => ({
  id: c.id,
  goalId: c.goalId,
  kind: c.kind,
  title: c.title,
  data:
    c.kind === "photos"
      ? { photos: photosOf(c).map((p) => ({ id: p.id, url: photoUrl(p.path), caption: p.caption })) }
      : c.kind === "notes"
        ? { notes: notesOf(c.data) }
        : c.data,
});

// Best effort, like a goal's replaced photo: a leftover file only costs storage.
const deletePhotos = (paths: string[]) =>
  paths.length
    ? del(paths).catch((err) => console.error("Deleting card photos failed:", err))
    : undefined;

type Me = NonNullable<Awaited<ReturnType<typeof getMembership>>>;

async function listCards(me: Me, goalId: string) {
  const list = await db
    .select()
    .from(goalCards)
    .where(and(eq(goalCards.goalId, goalId), eq(goalCards.spaceId, me.spaceId)))
    .orderBy(asc(goalCards.position), asc(goalCards.createdAt));
  return json({ cards: list.map(cardToClient) });
}

async function createCard(me: Me, body: Row) {
  if (!isKind(body.kind)) return json({ error: `kind must be one of ${KINDS.join(", ")}` }, 400);
  if (typeof body.goalId !== "string") return json({ error: "Send { goalId, kind }" }, 400);
  const [goal] = await db
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.id, body.goalId), eq(goals.spaceId, me.spaceId)));
  if (!goal) return json({ error: "Goal not found" }, 404);

  const [{ last, count }] = await db
    .select({ last: max(goalCards.position), count: sql<number>`count(*)::int` })
    .from(goalCards)
    .where(eq(goalCards.goalId, goal.id));
  if (count >= MAX_CARDS) return json({ error: `A goal can have up to ${MAX_CARDS} cards` }, 400);

  const [card] = await db
    .insert(goalCards)
    .values({
      spaceId: me.spaceId,
      goalId: goal.id,
      kind: body.kind,
      title: kindTitles[body.kind],
      position: (last ?? -1) + 1,
      data: emptyData[body.kind],
    })
    .returning();
  return json({ card: cardToClient(card) }, 201);
}

async function updateCard(me: Me, body: Row) {
  if (typeof body.id !== "string") return json({ error: "Send { id, ... }" }, 400);
  const mine = and(eq(goalCards.id, body.id), eq(goalCards.spaceId, me.spaceId));
  const [existing] = await db.select().from(goalCards).where(mine);
  if (!existing || !isKind(existing.kind)) return json({ error: "Card not found" }, 404);

  const changes: Partial<typeof goalCards.$inferInsert> = {};
  if ("title" in body) {
    const title = text(body.title, 60).trim();
    if (!title) return json({ error: "Give the card a title" }, 400);
    changes.title = title;
  }
  if ("data" in body) changes.data = cleanData(existing.kind, body.data, me.spaceId);

  const [card] = Object.keys(changes).length
    ? await db.update(goalCards).set(changes).where(mine).returning()
    : [existing];

  // Photos taken off the card: delete their files.
  const kept = new Set(photosOf(card).map((p) => p.path));
  await deletePhotos(
    photosOf(existing)
      .map((p) => p.path)
      .filter((path) => !kept.has(path) && isSpacePhoto(path, me.spaceId)),
  );
  return json({ card: cardToClient(card) });
}

async function reorderCards(me: Me, body: Row) {
  const order = Array.isArray(body.order) ? body.order.filter((v) => typeof v === "string") : [];
  if (typeof body.goalId !== "string" || !order.length || order.length > MAX_CARDS)
    return json({ error: "Send { goalId, order: [card ids] }" }, 400);
  const inGoal = and(eq(goalCards.goalId, body.goalId), eq(goalCards.spaceId, me.spaceId));
  const updates = order.map((id, position) =>
    db.update(goalCards).set({ position }).where(and(inGoal, eq(goalCards.id, id))),
  );
  await db.batch(updates as [(typeof updates)[number], ...typeof updates]);
  return json({ ok: true });
}

async function auth(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return { error: json({ error: "Not signed in" }, 401) };
  const me = await getMembership(userId);
  if (!me) return { error: json({ error: "Create a space first" }, 400) };
  return { me };
}

// List the space's goals, oldest first.
export async function GET(req: Request) {
  const { me, error } = await auth(req);
  if (error) return error;

  const cardsOf = new URL(req.url).searchParams.get("cards");
  if (cardsOf) return listCards(me, cardsOf);

  const list = await db
    .select()
    .from(goals)
    .where(eq(goals.spaceId, me.spaceId))
    .orderBy(asc(goals.createdAt));
  return json({ goals: list.map(toClient) });
}

// Remove a card from a goal's page: DELETE /api/goals?card=<id>
export async function DELETE(req: Request) {
  const { me, error } = await auth(req);
  if (error) return error;

  const id = new URL(req.url).searchParams.get("card");
  if (!id) return json({ error: "Send ?card=<id>" }, 400);
  const [gone] = await db
    .delete(goalCards)
    .where(and(eq(goalCards.id, id), eq(goalCards.spaceId, me.spaceId)))
    .returning();
  if (!gone) return json({ error: "Card not found" }, 404);
  await deletePhotos(photosOf(gone).map((p) => p.path).filter((p) => isSpacePhoto(p, me.spaceId)));
  return json({ ok: true });
}

// Create a goal:
// { title, category?, ownerUserId?: string | null, nextStep?, targetDate?: "YYYY-MM-DD",
//   targetCents?, imageUrl?: url from /api/photos }
export async function POST(req: Request) {
  const { me, error } = await auth(req);
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (body?.type === "card") return createCard(me, body);

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 80)
    return json({ error: "Give the goal a name (up to 80 characters)" }, 400);

  const category = body?.category ?? "life";
  if (!isCategory(category))
    return json({ error: `category must be one of ${goalCategoryEnum.enumValues.join(", ")}` }, 400);

  const nextStep = typeof body?.nextStep === "string" ? body.nextStep.trim().slice(0, 120) : "";

  const targetDate = body?.targetDate ?? null;
  if (targetDate !== null && !isDay(targetDate))
    return json({ error: "targetDate must be a date like 2027-03-01" }, 400);

  const targetCents = body?.targetCents ?? null;
  if (targetCents !== null && !(Number.isInteger(targetCents) && targetCents > 0))
    return json({ error: "targetCents must be a positive whole number" }, 400);

  const ownerUserId: string | null = body?.ownerUserId ?? null;
  if (ownerUserId && !(await isMember(me.spaceId, ownerUserId)))
    return json({ error: "Owner must be in your space" }, 400);

  const image = parseImage(body?.imageUrl ?? null, me.spaceId);
  if ("error" in image) return json({ error: image.error }, 400);

  const [goal] = await db
    .insert(goals)
    .values({
      spaceId: me.spaceId,
      name: title,
      category,
      ownerUserId,
      nextStep: nextStep || null,
      stepsTotal: nextStep ? 1 : 0,
      targetDate,
      targetCents,
      imageUrl: image.path,
    })
    .returning();
  await logActivity({
    spaceId: me.spaceId,
    actorUserId: me.clerkUserId,
    kind: "goal_added",
    title,
    goalId: goal.id,
  });
  return json({ goal: toClient(goal) }, 201);
}

// Columns to update; a value may be SQL (e.g. greatest(steps_total, 1)).
type GoalInsert = typeof goals.$inferInsert;
type GoalChanges = { [K in keyof GoalInsert]?: GoalInsert[K] | SQL };

// Update a goal. Every field is optional; only the ones sent change:
// { id, title?, category?, ownerUserId?: string | null, nextStep?: string | null,
//   targetDate?: "YYYY-MM-DD" | null, imageUrl?: url from /api/photos | null,
//   featured?: true, completed?: true }
export async function PATCH(req: Request) {
  const { me, error } = await auth(req);
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (body?.type === "card") return updateCard(me, body);
  if (body?.type === "card-order") return reorderCards(me, body);

  if (typeof body?.id !== "string") return json({ error: "Send { id, ... }" }, 400);
  const mine = and(eq(goals.id, body.id), eq(goals.spaceId, me.spaceId));

  const [existing] = await db
    .select({ id: goals.id, imageUrl: goals.imageUrl })
    .from(goals)
    .where(mine);
  if (!existing) return json({ error: "Goal not found" }, 404);

  // Validate everything before writing anything.
  const changes: GoalChanges = {};
  if ("title" in body) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title || title.length > 80)
      return json({ error: "Give the goal a name (up to 80 characters)" }, 400);
    changes.name = title;
  }
  if ("category" in body) {
    if (!isCategory(body.category))
      return json({ error: `category must be one of ${goalCategoryEnum.enumValues.join(", ")}` }, 400);
    changes.category = body.category;
  }
  if ("ownerUserId" in body) {
    const owner = body.ownerUserId ?? null;
    if (owner !== null && (typeof owner !== "string" || !(await isMember(me.spaceId, owner))))
      return json({ error: "Owner must be in your space" }, 400);
    changes.ownerUserId = owner;
  }
  if ("nextStep" in body) {
    const nextStep = typeof body.nextStep === "string" ? body.nextStep.trim().slice(0, 120) : "";
    changes.nextStep = nextStep || null;
    // A goal with no steps gets its first one, as on create.
    if (nextStep) changes.stepsTotal = sql`greatest(${goals.stepsTotal}, 1)`;
  }
  if ("targetDate" in body) {
    if (body.targetDate !== null && !isDay(body.targetDate))
      return json({ error: "targetDate must be a date like 2027-03-01, or null" }, 400);
    changes.targetDate = body.targetDate;
  }
  if ("imageUrl" in body) {
    const image = parseImage(body.imageUrl, me.spaceId);
    if ("error" in image) return json({ error: image.error }, 400);
    changes.imageUrl = image.path;
  }
  if (body.completed === true) {
    const total = sql`greatest(${goals.stepsTotal}, 1)`;
    Object.assign(changes, { stepsTotal: total, stepsDone: total, nextStep: null });
  }

  if (body.featured === true) {
    // One featured goal per space (unique index): clear the old one first, in one transaction.
    await db.batch([
      db
        .update(goals)
        .set({ featured: false })
        .where(and(eq(goals.spaceId, me.spaceId), eq(goals.featured, true))),
      db.update(goals).set({ featured: true }).where(mine),
    ]);
  }

  const [goal] = Object.keys(changes).length
    ? await db.update(goals).set(changes).where(mine).returning()
    : await db.select().from(goals).where(mine);

  // The old photo was replaced or removed: delete the file. Best effort; a
  // leftover file costs a little storage, never correctness.
  const oldPhoto = existing.imageUrl;
  if ("imageUrl" in changes && oldPhoto !== goal.imageUrl && isSpacePhoto(oldPhoto, me.spaceId))
    await del(oldPhoto).catch((err) => console.error("Deleting old photo failed:", err));

  const log = { spaceId: me.spaceId, actorUserId: me.clerkUserId, title: goal.name, goalId: goal.id };
  if (body.completed === true) await logActivity({ ...log, kind: "goal_completed" });
  if (goal.imageUrl && goal.imageUrl !== oldPhoto) await logActivity({ ...log, kind: "goal_photo" });

  return json({ goal: toClient(goal) });
}
