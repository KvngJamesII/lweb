import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { loginSchema, registerSchema } from "@shared/schema";
import { z } from "zod";
import { PairingHandler } from "./pairing.js";
import os from "os";
import bcrypt from "bcrypt";

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId || req.session.userRole !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.ip || req.socket.remoteAddress || "unknown";
}

async function maintenanceGuard(req: Request, res: Response, next: NextFunction) {
  if (req.path.startsWith("/api/auth") || req.path.startsWith("/api/admin")) {
    return next();
  }
  if (req.session.userRole === "admin") {
    return next();
  }
  const maintenance = await storage.getSetting("maintenance_mode");
  if (maintenance === "true") {
    return res.status(503).json({ message: "Site is under maintenance" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.use("/api", maintenanceGuard);

  const adminExists = await storage.getUserByEmail("admin@luca.bot");
  if (!adminExists) {
    const admin = await storage.createUser("admin@luca.bot", "admin123");
    const { db } = await import("./db");
    const { users } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    await db.update(users).set({ role: "admin" }).where(eq(users.id, admin.id));
    console.log("[AUTH] Default admin created — email: admin@luca.bot / password: admin123");
  }

  app.post("/api/auth/register", async (req, res) => {
    try {
      const input = registerSchema.parse(req.body);
      const ip = getClientIp(req);

      const existing = await storage.getUserByEmail(input.email);
      if (existing) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const ipCount = await storage.getAccountCountByIp(ip);
      if (ipCount >= 3) {
        return res.status(400).json({ message: "Too many accounts from this IP address" });
      }

      const user = await storage.createUser(input.email, input.password, ip);
      await storage.trackIp(ip, user.id, "register");

      req.session.userId = user.id;
      req.session.userRole = user.role;

      res.json({
        id: user.id,
        email: user.email,
        role: user.role,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("[AUTH] Register error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const input = loginSchema.parse(req.body);

      const user = await storage.getUserByEmail(input.email);
      if (!user) {
        return res.status(400).json({ message: "Invalid email or password" });
      }

      if (user.banned) {
        return res.status(403).json({ message: "Your account has been banned" });
      }

      const valid = await storage.verifyPassword(input.password, user.password);
      if (!valid) {
        return res.status(400).json({ message: "Invalid email or password" });
      }

      const ip = getClientIp(req);
      await storage.trackIp(ip, user.id, "login");

      req.session.userId = user.id;
      req.session.userRole = user.role;

      res.json({
        id: user.id,
        email: user.email,
        role: user.role,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("[AUTH] Login error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUserById(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    const maintenance = await storage.getSetting("maintenance_mode");
    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      maintenanceMode: maintenance === "true",
    });
  });

  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }
      const user = await storage.getUserById(req.session.userId!);
      if (!user) return res.status(404).json({ message: "User not found" });

      const valid = await storage.verifyPassword(currentPassword, user.password);
      if (!valid) return res.status(400).json({ message: "Current password is incorrect" });

      await storage.updateUserPassword(user.id, newPassword);
      res.json({ message: "Password updated" });
    } catch (err) {
      console.error("[AUTH] Change password error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/bot/status", requireAuth, async (req, res) => {
    const bot = await storage.getUserBot(req.session.userId!);
    if (!bot) {
      return res.json({ status: "no_bot", phoneNumber: null });
    }
    res.json({ status: bot.status, phoneNumber: bot.phoneNumber });
  });

  app.post("/api/bot/disconnect", requireAuth, async (req, res) => {
    try {
      const bot = await storage.getUserBot(req.session.userId!);
      if (!bot) {
        return res.status(400).json({ message: "No bot connected" });
      }
      PairingHandler.cancelPairing(bot.phoneNumber);
      PairingHandler.removeBot(bot.phoneNumber);
      PairingHandler.deleteUserData(bot.phoneNumber);
      await storage.deleteUserBot(req.session.userId!);
      res.json({ message: "Bot disconnected" });
    } catch (err) {
      console.error("[BOT] Disconnect error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/pairing/request", requireAuth, async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      if (!phoneNumber || !/^\d{8,15}$/.test(phoneNumber)) {
        return res.status(400).json({ message: "Invalid phone number" });
      }

      const userId = req.session.userId!;

      const existingBot = await storage.getUserBot(userId);
      if (existingBot && existingBot.status === "connected") {
        return res.status(400).json({ message: "You already have an active bot. Disconnect first." });
      }

      console.log(`[API] Received pairing request for ${phoneNumber} (user: ${userId})`);

      PairingHandler.cancelPairing(phoneNumber);
      PairingHandler.deleteUserData(phoneNumber);

      await storage.createPairingRequest(phoneNumber, userId);

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
          await storage.updatePairingRequest(phoneNumber, { status: "connected" });
          await storage.createUserBot(userId, phoneNumber);
        },
        async (error) => {
          console.error(`[API] Pairing error for ${phoneNumber}:`, error.message);
          await storage.updatePairingRequest(phoneNumber, { status: "failed" });
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
          res.status(500).json({ message: "Failed to generate pairing code." });
        }
      }, 500);

      setTimeout(() => {
        clearInterval(checkForCode);
        if (!res.headersSent) {
          res.status(500).json({ message: "Timeout waiting for pairing code." });
        }
      }, 60000);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("[API] Error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/pairing/status/:phone", async (req, res) => {
    try {
      const phone = req.params.phone;
      const request = await storage.getPairingRequestByPhone(phone);
      if (!request) {
        return res.status(200).json({ status: "not_found" });
      }
      res.status(200).json({ status: request.status });
    } catch (err) {
      console.error("[API] Status check error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    const allUsers = await storage.getAllUsers();
    const allBots = await storage.getAllUserBots();
    const botMap = new Map(allBots.map(b => [b.userId, b]));

    const usersWithBots = allUsers.map(u => ({
      id: u.id,
      email: u.email,
      role: u.role,
      banned: u.banned,
      registrationIp: u.registrationIp,
      createdAt: u.createdAt,
      bot: botMap.get(u.id) || null,
    }));

    res.json(usersWithBots);
  });

  app.post("/api/admin/users/:id/ban", requireAdmin, async (req, res) => {
    const userId = parseInt(req.params.id);
    const { banned } = req.body;
    await storage.banUser(userId, !!banned);
    res.json({ message: banned ? "User banned" : "User unbanned" });
  });

  app.post("/api/admin/bot/:userId/restart", requireAdmin, async (req, res) => {
    const userId = parseInt(req.params.userId);
    const bot = await storage.getUserBot(userId);
    if (!bot) return res.status(404).json({ message: "No bot found for this user" });
    await PairingHandler.vpsRequest('/api/restart', { phone: bot.phoneNumber });
    await storage.updateUserBotStatus(userId, "connected");
    res.json({ message: "Bot restarted" });
  });

  app.post("/api/admin/bot/:userId/stop", requireAdmin, async (req, res) => {
    const userId = parseInt(req.params.userId);
    const bot = await storage.getUserBot(userId);
    if (!bot) return res.status(404).json({ message: "No bot found for this user" });
    await PairingHandler.vpsRequest('/api/stop', { phone: bot.phoneNumber });
    await storage.updateUserBotStatus(userId, "disconnected");
    res.json({ message: "Bot stopped" });
  });

  app.get("/api/admin/system", requireAdmin, async (_req, res) => {
    const vpsSystem = await PairingHandler.vpsRequest('/api/system');
    const memUsage = vpsSystem?.memory || process.memoryUsage();
    const totalMem = vpsSystem?.memory?.systemTotal || os.totalmem();
    const freeMem = vpsSystem?.memory?.systemFree || os.freemem();
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    const allBots = await storage.getAllUserBots();
    const activeBots = allBots.filter(b => b.status === "connected").length;
    const allUsers = await storage.getAllUsers();

    res.json({
      memory: {
        heapUsed: vpsSystem?.memory?.heapUsed || memUsage.heapUsed,
        heapTotal: vpsSystem?.memory?.heapTotal || memUsage.heapTotal,
        rss: vpsSystem?.memory?.rss || memUsage.rss,
        external: memUsage.external,
        systemTotal: totalMem,
        systemFree: freeMem,
      },
      cpu: {
        cores: vpsSystem?.cpu?.cores || cpus.length,
        model: vpsSystem?.cpu?.model || cpus[0]?.model || "Unknown",
        loadAverage: vpsSystem?.cpu?.loadAverage || loadAvg,
      },
      uptime: vpsSystem?.uptime || process.uptime(),
      platform: vpsSystem?.platform || os.platform(),
      nodeVersion: vpsSystem?.nodeVersion || process.version,
      totalUsers: allUsers.length,
      activeBots: vpsSystem?.runningBots || activeBots,
      totalBots: allBots.length,
      vpsConnected: !!vpsSystem,
    });
  });

  app.get("/api/admin/maintenance", requireAdmin, async (_req, res) => {
    const maintenance = await storage.getSetting("maintenance_mode");
    res.json({ enabled: maintenance === "true" });
  });

  app.post("/api/admin/maintenance", requireAdmin, async (req, res) => {
    const { enabled } = req.body;
    await storage.setSetting("maintenance_mode", enabled ? "true" : "false");
    res.json({ message: enabled ? "Maintenance mode enabled" : "Maintenance mode disabled" });
  });

  return httpServer;
}
