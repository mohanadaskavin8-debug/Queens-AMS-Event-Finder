import { Router, type IRouter } from "express";
import { and, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { db, buildingsTable, eventsTable } from "@workspace/db";
import {
  CreateEventBody,
  UpdateEventBody,
  GetEventParams,
  UpdateEventParams,
  DeleteEventParams,
  ListEventsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function getEventStatusFromDates(
  startTime: Date,
  endTime: Date,
  now: Date
): "active" | "upcoming_today" | "upcoming_week" | "future" {
  if (startTime <= now && endTime >= now) return "active";
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  if (startTime > now && startTime <= todayEnd) return "upcoming_today";
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);
  if (startTime > now && startTime <= weekEnd) return "upcoming_week";
  return "future";
}

router.get("/events/summary", async (_req, res): Promise<void> => {
  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const buildings = await db.select().from(buildingsTable);

  const activeCounts = await db
    .select({ buildingId: eventsTable.buildingId, count: sql<number>`count(*)::int` })
    .from(eventsTable)
    .where(and(lte(eventsTable.startTime, now), gte(eventsTable.endTime, now)))
    .groupBy(eventsTable.buildingId);

  const todayCounts = await db
    .select({ buildingId: eventsTable.buildingId, count: sql<number>`count(*)::int` })
    .from(eventsTable)
    .where(and(gte(eventsTable.startTime, now), lte(eventsTable.startTime, todayEnd)))
    .groupBy(eventsTable.buildingId);

  const weekCounts = await db
    .select({ buildingId: eventsTable.buildingId, count: sql<number>`count(*)::int` })
    .from(eventsTable)
    .where(and(gte(eventsTable.startTime, now), lte(eventsTable.startTime, weekEnd)))
    .groupBy(eventsTable.buildingId);

  const activeMap = new Map(activeCounts.map((r) => [r.buildingId, r.count]));
  const todayMap = new Map(todayCounts.map((r) => [r.buildingId, r.count]));
  const weekMap = new Map(weekCounts.map((r) => [r.buildingId, r.count]));

  const summary = buildings.map((b) => {
    const activeEventCount = activeMap.get(b.id) ?? 0;
    const todayEventCount = todayMap.get(b.id) ?? 0;
    const weekEventCount = weekMap.get(b.id) ?? 0;

    let eventStatus: "none" | "upcoming_week" | "upcoming_today" | "active" = "none";
    if (activeEventCount > 0) eventStatus = "active";
    else if (todayEventCount > 0) eventStatus = "upcoming_today";
    else if (weekEventCount > 0) eventStatus = "upcoming_week";

    return {
      buildingId: b.id,
      buildingName: b.name,
      eventStatus,
      activeEventCount,
      todayEventCount,
      weekEventCount,
    };
  });

  res.json(summary);
});

router.get("/events", async (req, res): Promise<void> => {
  const parsed = ListEventsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { category, timeframe, search, buildingId } = parsed.data;
  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const conditions = [];

  if (category && category !== "all") {
    conditions.push(eq(eventsTable.category, category as "ams" | "residence" | "academic" | "athletics"));
  }

  if (timeframe === "now") {
    conditions.push(lte(eventsTable.startTime, now));
    conditions.push(gte(eventsTable.endTime, now));
  } else if (timeframe === "today") {
    conditions.push(gte(eventsTable.startTime, now));
    conditions.push(lte(eventsTable.startTime, todayEnd));
  } else if (timeframe === "week") {
    conditions.push(gte(eventsTable.startTime, now));
    conditions.push(lte(eventsTable.startTime, weekEnd));
  }

  if (buildingId) {
    conditions.push(eq(eventsTable.buildingId, Number(buildingId)));
  }

  if (search) {
    const q = `%${search}%`;
    conditions.push(
      or(
        ilike(eventsTable.title, q),
        ilike(eventsTable.organizer, q),
        ilike(buildingsTable.name, q),
      )
    );
  }

  const rows = await db
    .select({
      event: eventsTable,
      buildingName: buildingsTable.name,
    })
    .from(eventsTable)
    .innerJoin(buildingsTable, eq(eventsTable.buildingId, buildingsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(eventsTable.startTime);

  const result = rows.map((r) => ({
    ...r.event,
    buildingName: r.buildingName,
    status: getEventStatusFromDates(r.event.startTime, r.event.endTime, now),
    startTime: r.event.startTime.toISOString(),
    endTime: r.event.endTime.toISOString(),
  }));

  res.json(result);
});

router.post("/events", async (req, res): Promise<void> => {
  const parsed = CreateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [building] = await db
    .select()
    .from(buildingsTable)
    .where(eq(buildingsTable.id, parsed.data.buildingId));

  if (!building) {
    res.status(400).json({ error: "Building not found" });
    return;
  }

  const now = new Date();
  const [event] = await db
    .insert(eventsTable)
    .values({
      ...parsed.data,
      startTime: new Date(parsed.data.startTime),
      endTime: new Date(parsed.data.endTime),
    })
    .returning();

  res.status(201).json({
    ...event,
    buildingName: building.name,
    status: getEventStatusFromDates(event.startTime, event.endTime, now),
    startTime: event.startTime.toISOString(),
    endTime: event.endTime.toISOString(),
  });
});

router.get("/events/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = GetEventParams.safeParse({ id: raw });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const now = new Date();
  const rows = await db
    .select({ event: eventsTable, buildingName: buildingsTable.name })
    .from(eventsTable)
    .innerJoin(buildingsTable, eq(eventsTable.buildingId, buildingsTable.id))
    .where(eq(eventsTable.id, parsed.data.id));

  if (!rows[0]) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const { event, buildingName } = rows[0];
  res.json({
    ...event,
    buildingName,
    status: getEventStatusFromDates(event.startTime, event.endTime, now),
    startTime: event.startTime.toISOString(),
    endTime: event.endTime.toISOString(),
  });
});

router.patch("/events/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateEventParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.startTime) updateData.startTime = new Date(parsed.data.startTime);
  if (parsed.data.endTime) updateData.endTime = new Date(parsed.data.endTime);

  const [event] = await db
    .update(eventsTable)
    .set(updateData)
    .where(eq(eventsTable.id, params.data.id))
    .returning();

  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const rows = await db
    .select({ buildingName: buildingsTable.name })
    .from(buildingsTable)
    .where(eq(buildingsTable.id, event.buildingId));

  const buildingName = rows[0]?.buildingName ?? "";
  const now = new Date();

  res.json({
    ...event,
    buildingName,
    status: getEventStatusFromDates(event.startTime, event.endTime, now),
    startTime: event.startTime.toISOString(),
    endTime: event.endTime.toISOString(),
  });
});

router.delete("/events/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = DeleteEventParams.safeParse({ id: raw });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [event] = await db
    .delete(eventsTable)
    .where(eq(eventsTable.id, parsed.data.id))
    .returning();

  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
