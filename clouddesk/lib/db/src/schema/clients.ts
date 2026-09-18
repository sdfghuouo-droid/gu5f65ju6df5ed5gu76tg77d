import { pgTable, text, uuid, real, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clientStatusEnum = pgEnum("client_status", ["online", "offline", "alerting", "maintenance"]);
export const clientHealthEnum = pgEnum("client_health", ["good", "warning", "critical"]);

export const clientsTable = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  hostname: text("hostname").notNull(),
  username: text("username"),
  os: text("os"),
  ipAddress: text("ip_address"),
  agentVersion: text("agent_version"),
  agentToken: text("agent_token").notNull().unique(),
  cpu: real("cpu"),
  ram: real("ram"),
  ramTotal: real("ram_total"),
  disk: real("disk"),
  diskTotal: real("disk_total"),
  status: clientStatusEnum("status").notNull().default("offline"),
  health: clientHealthEnum("health").notNull().default("good"),
  group: text("group"),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertClientSchema = createInsertSchema(clientsTable).omit({
  id: true,
  agentToken: true,
  createdAt: true,
});
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;
