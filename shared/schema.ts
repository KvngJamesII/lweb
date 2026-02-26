import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const pairingRequests = pgTable("pairing_requests", {
  id: serial("id").primaryKey(),
  phoneNumber: text("phone_number").notNull(),
  status: text("status").notNull().default("pending"), // pending, code_generated, connected, failed
  pairingCode: text("pairing_code"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPairingRequestSchema = createInsertSchema(pairingRequests).omit({
  id: true, createdAt: true, status: true, pairingCode: true
});

export type InsertPairingRequest = z.infer<typeof insertPairingRequestSchema>;
export type PairingRequest = typeof pairingRequests.$inferSelect;
