import { db } from "./db";
import {
  users, userBots, siteSettings, ipTracking, pairingRequests,
  type User, type UserBot, type PairingRequest, type SiteSetting,
} from "@shared/schema";
import { eq, desc, and, count } from "drizzle-orm";
import bcrypt from "bcrypt";

export interface IStorage {
  createUser(email: string, password: string, ip?: string): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  verifyPassword(password: string, hash: string): Promise<boolean>;
  updateUserPassword(userId: number, newPassword: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  banUser(userId: number, banned: boolean): Promise<void>;

  getAccountCountByIp(ip: string): Promise<number>;
  trackIp(ip: string, userId: number, action: string): Promise<void>;

  getUserBot(userId: number): Promise<UserBot | undefined>;
  createUserBot(userId: number, phoneNumber: string): Promise<UserBot>;
  updateUserBotStatus(userId: number, status: string): Promise<void>;
  deleteUserBot(userId: number): Promise<void>;
  getAllUserBots(): Promise<UserBot[]>;

  getSetting(key: string): Promise<string | undefined>;
  setSetting(key: string, value: string): Promise<void>;

  createPairingRequest(phone: string, userId?: number): Promise<PairingRequest>;
  updatePairingRequest(phone: string, updates: Partial<PairingRequest>): Promise<PairingRequest | undefined>;
  getPairingRequestByPhone(phone: string): Promise<PairingRequest | undefined>;
  deletePairingRequestsByPhone(phone: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async createUser(email: string, password: string, ip?: string): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [user] = await db.insert(users)
      .values({ email, password: hashedPassword, registrationIp: ip || null })
      .returning();
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async updateUserPassword(userId: number, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async banUser(userId: number, banned: boolean): Promise<void> {
    await db.update(users).set({ banned }).where(eq(users.id, userId));
  }

  async getAccountCountByIp(ip: string): Promise<number> {
    const result = await db.select({ count: count() }).from(users).where(eq(users.registrationIp, ip));
    return result[0]?.count || 0;
  }

  async trackIp(ip: string, userId: number, action: string): Promise<void> {
    await db.insert(ipTracking).values({ ipAddress: ip, userId, action });
  }

  async getUserBot(userId: number): Promise<UserBot | undefined> {
    const [bot] = await db.select().from(userBots).where(eq(userBots.userId, userId)).limit(1);
    return bot;
  }

  async createUserBot(userId: number, phoneNumber: string): Promise<UserBot> {
    await db.delete(userBots).where(eq(userBots.userId, userId));
    const [bot] = await db.insert(userBots)
      .values({ userId, phoneNumber, status: "connected" })
      .returning();
    return bot;
  }

  async updateUserBotStatus(userId: number, status: string): Promise<void> {
    await db.update(userBots).set({ status }).where(eq(userBots.userId, userId));
  }

  async deleteUserBot(userId: number): Promise<void> {
    await db.delete(userBots).where(eq(userBots.userId, userId));
  }

  async getAllUserBots(): Promise<UserBot[]> {
    return db.select().from(userBots);
  }

  async getSetting(key: string): Promise<string | undefined> {
    const [setting] = await db.select().from(siteSettings).where(eq(siteSettings.key, key)).limit(1);
    return setting?.value;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const existing = await this.getSetting(key);
    if (existing !== undefined) {
      await db.update(siteSettings).set({ value }).where(eq(siteSettings.key, key));
    } else {
      await db.insert(siteSettings).values({ key, value });
    }
  }

  async deletePairingRequestsByPhone(phone: string): Promise<void> {
    await db.delete(pairingRequests).where(eq(pairingRequests.phoneNumber, phone));
  }

  async createPairingRequest(phone: string, userId?: number): Promise<PairingRequest> {
    await this.deletePairingRequestsByPhone(phone);
    const [request] = await db.insert(pairingRequests)
      .values({ phoneNumber: phone, userId: userId || null })
      .returning();
    return request;
  }

  async updatePairingRequest(phone: string, updates: Partial<PairingRequest>): Promise<PairingRequest | undefined> {
    const [updated] = await db.update(pairingRequests)
      .set(updates)
      .where(eq(pairingRequests.phoneNumber, phone))
      .returning();
    return updated;
  }

  async getPairingRequestByPhone(phone: string): Promise<PairingRequest | undefined> {
    const [request] = await db.select()
      .from(pairingRequests)
      .where(eq(pairingRequests.phoneNumber, phone))
      .orderBy(desc(pairingRequests.id))
      .limit(1);
    return request;
  }
}

export const storage = new DatabaseStorage();
