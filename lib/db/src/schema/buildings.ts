import { pgTable, text, serial, real, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const BUILDING_CATEGORIES = [
  "academic",
  "student_life",
  "residences",
  "landmarks",
] as const;

export const buildingsTable = pgTable("buildings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  description: text("description"),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  levels: integer("levels").notNull().default(3),
  footprint: jsonb("footprint").$type<number[][] | null>(),
  category: text("category", { enum: BUILDING_CATEGORIES }).notNull().default("landmarks"),
  imageUrl: text("image_url"),
});

export const insertBuildingSchema = createInsertSchema(buildingsTable).omit({ id: true });
export type InsertBuilding = z.infer<typeof insertBuildingSchema>;
export type Building = typeof buildingsTable.$inferSelect;
