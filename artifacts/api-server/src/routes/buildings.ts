import { Router, type IRouter } from "express";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db, buildingsTable, eventsTable } from "@workspace/db";
import {
  GetBuildingParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function getEventStatus(
  activeCount: number,
  todayCount: number,
  weekCount: number
): "active" | "upcoming_today" | "upcoming_week" | "none" {
  if (activeCount > 0) return "active";
  if (todayCount > 0) return "upcoming_today";
  if (weekCount > 0) return "upcoming_week";
  return "none";
}

async function getBuildingEventCounts(now: Date) {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const activeCounts = await db
    .select({
      buildingId: eventsTable.buildingId,
      count: sql<number>`count(*)::int`,
    })
    .from(eventsTable)
    .where(and(lte(eventsTable.startTime, now), gte(eventsTable.endTime, now)))
    .groupBy(eventsTable.buildingId);

  const todayCounts = await db
    .select({
      buildingId: eventsTable.buildingId,
      count: sql<number>`count(*)::int`,
    })
    .from(eventsTable)
    .where(
      and(
        gte(eventsTable.startTime, now),
        lte(eventsTable.startTime, todayEnd)
      )
    )
    .groupBy(eventsTable.buildingId);

  const weekCounts = await db
    .select({
      buildingId: eventsTable.buildingId,
      count: sql<number>`count(*)::int`,
    })
    .from(eventsTable)
    .where(
      and(
        gte(eventsTable.startTime, now),
        lte(eventsTable.startTime, weekEnd)
      )
    )
    .groupBy(eventsTable.buildingId);

  return { activeCounts, todayCounts, weekCounts };
}

router.get("/buildings", async (req, res): Promise<void> => {
  const now = new Date();
  const buildings = await db.select().from(buildingsTable).orderBy(buildingsTable.name);
  const { activeCounts, todayCounts, weekCounts } = await getBuildingEventCounts(now);

  const activeMap = new Map(activeCounts.map((r) => [r.buildingId, r.count]));
  const todayMap = new Map(todayCounts.map((r) => [r.buildingId, r.count]));
  const weekMap = new Map(weekCounts.map((r) => [r.buildingId, r.count]));

  const result = buildings.map((b) => {
    const activeEventCount = activeMap.get(b.id) ?? 0;
    const todayEventCount = todayMap.get(b.id) ?? 0;
    const weekEventCount = weekMap.get(b.id) ?? 0;
    return {
      ...b,
      eventStatus: getEventStatus(activeEventCount, todayEventCount, weekEventCount),
      activeEventCount,
      todayEventCount,
      weekEventCount,
    };
  });

  res.json(result);
});

router.get("/buildings/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = GetBuildingParams.safeParse({ id: raw });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const now = new Date();
  const [building] = await db
    .select()
    .from(buildingsTable)
    .where(eq(buildingsTable.id, parsed.data.id));

  if (!building) {
    res.status(404).json({ error: "Building not found" });
    return;
  }

  const events = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.buildingId, building.id))
    .orderBy(eventsTable.startTime);

  const enrichedEvents = events.map((e) => ({
    ...e,
    buildingName: building.name,
    status: getEventStatusFromDates(e.startTime, e.endTime, now),
    startTime: e.startTime.toISOString(),
    endTime: e.endTime.toISOString(),
  }));

  const { activeCounts, todayCounts, weekCounts } = await getBuildingEventCounts(now);
  const activeMap = new Map(activeCounts.map((r) => [r.buildingId, r.count]));
  const todayMap = new Map(todayCounts.map((r) => [r.buildingId, r.count]));
  const weekMap = new Map(weekCounts.map((r) => [r.buildingId, r.count]));

  const activeEventCount = activeMap.get(building.id) ?? 0;
  const todayEventCount = todayMap.get(building.id) ?? 0;
  const weekEventCount = weekMap.get(building.id) ?? 0;

  res.json({
    ...building,
    eventStatus: getEventStatus(activeEventCount, todayEventCount, weekEventCount),
    activeEventCount,
    todayEventCount,
    weekEventCount,
    events: enrichedEvents,
  });
});

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

export default router;
