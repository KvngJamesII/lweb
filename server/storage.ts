import { db } from "./db";
import { pairingRequests, type InsertPairingRequest, type PairingRequest } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  createPairingRequest(phone: string): Promise<PairingRequest>;
  updatePairingRequest(phone: string, updates: Partial<PairingRequest>): Promise<PairingRequest | undefined>;
  getPairingRequestByPhone(phone: string): Promise<PairingRequest | undefined>;
}

export class DatabaseStorage implements IStorage {
  async createPairingRequest(phone: string): Promise<PairingRequest> {
    const [request] = await db.insert(pairingRequests)
      .values({ phoneNumber: phone })
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
      .limit(1);
    return request;
  }
}

export const storage = new DatabaseStorage();
