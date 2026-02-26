import { db } from "./db";
import {
  users, userBots, siteSettings, ipTracking, pairingRequests,
  notifications, supportTickets, supportMessages, announcements,
  type User, type UserBot, type PairingRequest, type SiteSetting,
  type Notification, type SupportTicket, type SupportMessage, type Announcement,
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

  createNotification(userId: number, title: string, message: string, type?: string): Promise<Notification>;
  getUserNotifications(userId: number): Promise<Notification[]>;
  getUnreadNotificationCount(userId: number): Promise<number>;
  markNotificationRead(notificationId: number, userId: number): Promise<void>;
  markAllNotificationsRead(userId: number): Promise<void>;

  createSupportTicket(userId: number, subject: string): Promise<SupportTicket>;
  getSupportTicket(ticketId: number): Promise<SupportTicket | undefined>;
  getUserSupportTickets(userId: number): Promise<SupportTicket[]>;
  getAllSupportTickets(): Promise<SupportTicket[]>;
  updateTicketStatus(ticketId: number, status: string): Promise<void>;
  addSupportMessage(ticketId: number, senderId: number, senderRole: string, message: string): Promise<SupportMessage>;
  getTicketMessages(ticketId: number): Promise<SupportMessage[]>;

  createAnnouncement(message: string, link?: string): Promise<Announcement>;
  getActiveAnnouncements(): Promise<Announcement[]>;
  deleteAnnouncement(id: number): Promise<void>;
  getAllAnnouncements(): Promise<Announcement[]>;

  toggleTicketAi(ticketId: number, enabled: boolean): Promise<void>;
  getOpenTicketCountForAdmin(): Promise<number>;
  getUnrepliedTicketCount(userId: number): Promise<number>;
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

  async createNotification(userId: number, title: string, message: string, type: string = "info"): Promise<Notification> {
    const [notif] = await db.insert(notifications)
      .values({ userId, title, message, type })
      .returning();
    return notif;
  }

  async getUserNotifications(userId: number): Promise<Notification[]> {
    return db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
  }

  async getUnreadNotificationCount(userId: number): Promise<number> {
    const result = await db.select({ count: count() }).from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
    return result[0]?.count || 0;
  }

  async markNotificationRead(notificationId: number, userId: number): Promise<void> {
    await db.update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
  }

  async markAllNotificationsRead(userId: number): Promise<void> {
    await db.update(notifications)
      .set({ read: true })
      .where(eq(notifications.userId, userId));
  }

  async createSupportTicket(userId: number, subject: string): Promise<SupportTicket> {
    const [ticket] = await db.insert(supportTickets)
      .values({ userId, subject })
      .returning();
    return ticket;
  }

  async getSupportTicket(ticketId: number): Promise<SupportTicket | undefined> {
    const [ticket] = await db.select().from(supportTickets)
      .where(eq(supportTickets.id, ticketId))
      .limit(1);
    return ticket;
  }

  async getUserSupportTickets(userId: number): Promise<SupportTicket[]> {
    return db.select().from(supportTickets)
      .where(eq(supportTickets.userId, userId))
      .orderBy(desc(supportTickets.createdAt));
  }

  async getAllSupportTickets(): Promise<SupportTicket[]> {
    return db.select().from(supportTickets)
      .orderBy(desc(supportTickets.createdAt));
  }

  async updateTicketStatus(ticketId: number, status: string): Promise<void> {
    await db.update(supportTickets)
      .set({ status })
      .where(eq(supportTickets.id, ticketId));
  }

  async addSupportMessage(ticketId: number, senderId: number, senderRole: string, message: string): Promise<SupportMessage> {
    const [msg] = await db.insert(supportMessages)
      .values({ ticketId, senderId, senderRole, message })
      .returning();
    return msg;
  }

  async getTicketMessages(ticketId: number): Promise<SupportMessage[]> {
    return db.select().from(supportMessages)
      .where(eq(supportMessages.ticketId, ticketId))
      .orderBy(supportMessages.createdAt);
  }

  async createAnnouncement(message: string, link?: string): Promise<Announcement> {
    const [ann] = await db.insert(announcements)
      .values({ message, link: link || null })
      .returning();
    return ann;
  }

  async getActiveAnnouncements(): Promise<Announcement[]> {
    return db.select().from(announcements)
      .where(eq(announcements.active, true))
      .orderBy(desc(announcements.createdAt));
  }

  async deleteAnnouncement(id: number): Promise<void> {
    await db.delete(announcements).where(eq(announcements.id, id));
  }

  async getAllAnnouncements(): Promise<Announcement[]> {
    return db.select().from(announcements).orderBy(desc(announcements.createdAt));
  }

  async toggleTicketAi(ticketId: number, enabled: boolean): Promise<void> {
    await db.update(supportTickets)
      .set({ aiEnabled: enabled })
      .where(eq(supportTickets.id, ticketId));
  }

  async getOpenTicketCountForAdmin(): Promise<number> {
    const result = await db.select({ count: count() }).from(supportTickets)
      .where(eq(supportTickets.status, "open"));
    return result[0]?.count || 0;
  }

  async getUnrepliedTicketCount(userId: number): Promise<number> {
    const tickets = await db.select().from(supportTickets)
      .where(eq(supportTickets.userId, userId));
    let unreplied = 0;
    for (const ticket of tickets) {
      const msgs = await db.select().from(supportMessages)
        .where(eq(supportMessages.ticketId, ticket.id))
        .orderBy(desc(supportMessages.createdAt))
        .limit(1);
      if (msgs.length > 0 && (msgs[0].senderRole === "admin" || msgs[0].senderRole === "ai")) {
        unreplied++;
      }
    }
    return unreplied;
  }
}

export const storage = new DatabaseStorage();
