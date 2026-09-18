import { pgTable, text, uuid, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";

export const commandStatusEnum = pgEnum("command_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "timeout",
]);

export const commandsTable = pgTable("commands", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clientsTable.id, { onDelete: "cascade" }),
  command: text("command").notNull(),
  output: text("output"),
  exitCode: integer("exit_code"),
  status: commandStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const insertCommandSchema = createInsertSchema(commandsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertCommand = z.infer<typeof insertCommandSchema>;
export type Command = typeof commandsTable.$inferSelect;
