import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"),
  banned: boolean("banned").notNull().default(false),
  registrationIp: text("registration_ip"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userBots = pgTable("user_bots", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  phoneNumber: text("phone_number").notNull(),
  status: text("status").notNull().default("disconnected"),
  pairedAt: timestamp("paired_at").defaultNow(),
});

export const siteSettings = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

export const ipTracking = pgTable("ip_tracking", {
  id: serial("id").primaryKey(),
  ipAddress: text("ip_address").notNull(),
  userId: integer("user_id"),
  action: text("action").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pairingRequests = pgTable("pairing_requests", {
  id: serial("id").primaryKey(),
  phoneNumber: text("phone_number").notNull(),
  status: text("status").notNull().default("pending"),
  pairingCode: text("pairing_code"),
  userId: integer("user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true, createdAt: true, role: true, banned: true, registrationIp: true,
});

export const insertUserBotSchema = createInsertSchema(userBots).omit({
  id: true, pairedAt: true, status: true,
});

export const insertPairingRequestSchema = createInsertSchema(pairingRequests).omit({
  id: true, createdAt: true, status: true, pairingCode: true, userId: true,
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertUserBot = z.infer<typeof insertUserBotSchema>;
export type UserBot = typeof userBots.$inferSelect;
export type InsertPairingRequest = z.infer<typeof insertPairingRequestSchema>;
export type PairingRequest = typeof pairingRequests.$inferSelect;
export type SiteSetting = typeof siteSettings.$inferSelect;
