import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { PairingHandler } from "./pairing.js";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.post(api.pairing.request.path, async (req, res) => {
    try {
      const input = api.pairing.request.input.parse(req.body);
      const phoneNumber = input.phoneNumber;

      console.log(`[API] Received pairing request for ${phoneNumber}`);

      PairingHandler.cancelPairing(phoneNumber);
      PairingHandler.deleteUserData(phoneNumber);

      await storage.createPairingRequest(phoneNumber);

      PairingHandler.generatePairingCode(
        phoneNumber,
        async (code) => {
          console.log(`[API] Pairing code generated: ${code}`);
          await storage.updatePairingRequest(phoneNumber, {
            status: "code_generated",
            pairingCode: code,
          });
        },
        async () => {
          console.log(`[API] Connection successful for ${phoneNumber}`);
          await storage.updatePairingRequest(phoneNumber, {
            status: "connected",
          });
        },
        async (error) => {
          console.error(`[API] Pairing error for ${phoneNumber}:`, error.message);
          await storage.updatePairingRequest(phoneNumber, {
            status: "failed",
          });
        }
      );

      const checkForCode = setInterval(async () => {
        const request = await storage.getPairingRequestByPhone(phoneNumber);
        if (request?.pairingCode) {
          clearInterval(checkForCode);
          res.status(200).json({
            code: request.pairingCode,
            status: request.status,
          });
        } else if (request?.status === "failed") {
          clearInterval(checkForCode);
          res.status(500).json({
            message: "Failed to generate pairing code. Please try again.",
          });
        }
      }, 500);

      setTimeout(() => {
        clearInterval(checkForCode);
        if (!res.headersSent) {
          res.status(500).json({
            message: "Timeout waiting for pairing code.",
          });
        }
      }, 60000);

    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      console.error('[API] Error:', err);
      res.status(500).json({
        message: "Internal server error",
      });
    }
  });

  app.get(api.pairing.status.path, async (req, res) => {
    try {
      const phone = req.params.phone;
      const request = await storage.getPairingRequestByPhone(phone);

      if (!request) {
        return res.status(200).json({ status: "not_found" });
      }

      res.status(200).json({ status: request.status });
    } catch (err) {
      console.error('[API] Status check error:', err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  return httpServer;
}
