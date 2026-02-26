import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { loginSchema, registerSchema } from "@shared/schema";
import { z } from "zod";
import { PairingHandler } from "./pairing.js";
import { getAiSupportResponse } from "./ai-support.js";
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

  const adminExists = await storage.getUserByEmail("onlyidledev@gmail.com");
  if (!adminExists) {
    const admin = await storage.createUser("onlyidledev@gmail.com", "isr828u2");
    const { db } = await import("./db");
    const { users } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    await db.update(users).set({ role: "admin" }).where(eq(users.id, admin.id));
    console.log("[AUTH] Default admin created — email: onlyidledev@gmail.com");
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

  app.post("/api/admin/bots/restart-all", requireAdmin, async (_req, res) => {
    try {
      const allBots = await storage.getAllUserBots();
      const activeBots = allBots.filter(b => b.status === "connected");
      let restarted = 0;
      for (const bot of activeBots) {
        try {
          await PairingHandler.vpsRequest('/api/restart', { phone: bot.phoneNumber });
          restarted++;
        } catch (e) {
          console.error(`[ADMIN] Failed to restart bot ${bot.phoneNumber}:`, e);
        }
      }
      res.json({ message: `Restarted ${restarted}/${activeBots.length} bots` });
    } catch (err) {
      console.error("[ADMIN] Restart all error:", err);
      res.status(500).json({ message: "Failed to restart bots" });
    }
  });

  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const notifs = await storage.getUserNotifications(req.session.userId!);
      const unreadCount = await storage.getUnreadNotificationCount(req.session.userId!);
      res.json({ notifications: notifs, unreadCount });
    } catch (err) {
      console.error("[NOTIF] Error:", err);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.post("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      await storage.markNotificationRead(parseInt(req.params.id), req.session.userId!);
      res.json({ message: "Marked as read" });
    } catch (err) {
      res.status(500).json({ message: "Failed to mark notification" });
    }
  });

  app.post("/api/notifications/read-all", requireAuth, async (req, res) => {
    try {
      await storage.markAllNotificationsRead(req.session.userId!);
      res.json({ message: "All marked as read" });
    } catch (err) {
      res.status(500).json({ message: "Failed to mark notifications" });
    }
  });

  app.get("/api/support/tickets", requireAuth, async (req, res) => {
    try {
      const tickets = await storage.getUserSupportTickets(req.session.userId!);
      res.json(tickets);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch tickets" });
    }
  });

  app.post("/api/support/tickets", requireAuth, async (req, res) => {
    try {
      const { subject, message } = req.body;
      if (!subject || !message) {
        return res.status(400).json({ message: "Subject and message are required" });
      }
      const ticket = await storage.createSupportTicket(req.session.userId!, subject);
      await storage.addSupportMessage(ticket.id, req.session.userId!, "user", message);
      res.json(ticket);

      try {
        const aiReply = await getAiSupportResponse([
          { role: "user", content: `Subject: ${subject}\n\n${message}` },
        ]);
        await storage.addSupportMessage(ticket.id, 0, "ai", aiReply);
      } catch (e: any) {
        console.error("[AI-SUPPORT] Initial reply error:", e.message);
      }
    } catch (err) {
      res.status(500).json({ message: "Failed to create ticket" });
    }
  });

  app.get("/api/support/tickets/:id/messages", requireAuth, async (req, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      const ticket = await storage.getSupportTicket(ticketId);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (ticket.userId !== req.session.userId! && req.session.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const messages = await storage.getTicketMessages(ticketId);
      res.json({ ticket, messages });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/support/tickets/:id/messages", requireAuth, async (req, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      const ticket = await storage.getSupportTicket(ticketId);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (ticket.userId !== req.session.userId! && req.session.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const { message } = req.body;
      if (!message) return res.status(400).json({ message: "Message is required" });
      const role = req.session.userRole || "user";
      const msg = await storage.addSupportMessage(ticketId, req.session.userId!, role, message);
      res.json(msg);

      if (role === "admin" && ticket.aiEnabled) {
        await storage.toggleTicketAi(ticketId, false);
      }

      if (role === "user" && ticket.aiEnabled) {
        const allMessages = await storage.getTicketMessages(ticketId);
        const history = allMessages.map(m => ({
          role: m.senderRole === "user" ? "user" : "assistant",
          content: m.message,
        }));
        try {
          const aiReply = await getAiSupportResponse(history);
          await storage.addSupportMessage(ticketId, 0, "ai", aiReply);
        } catch (e: any) {
          console.error("[AI-SUPPORT] Auto-reply error:", e.message);
        }
      }
    } catch (err) {
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.post("/api/support/tickets/:id/request-agent", requireAuth, async (req, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      const ticket = await storage.getSupportTicket(ticketId);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (ticket.userId !== req.session.userId!) {
        return res.status(403).json({ message: "Access denied" });
      }
      await storage.toggleTicketAi(ticketId, false);
      await storage.addSupportMessage(ticketId, 0, "system", "You've been added to the queue. A live support agent will reply to you shortly. Please hang tight!");
      res.json({ message: "Live agent requested" });
    } catch (err) {
      res.status(500).json({ message: "Failed to request agent" });
    }
  });

  app.post("/api/admin/support/tickets/:id/toggle-ai", requireAdmin, async (req, res) => {
    try {
      const { enabled } = req.body;
      await storage.toggleTicketAi(parseInt(req.params.id), !!enabled);
      res.json({ message: enabled ? "AI resumed" : "AI paused" });
    } catch (err) {
      res.status(500).json({ message: "Failed to toggle AI" });
    }
  });

  app.get("/api/support/badge", requireAuth, async (req, res) => {
    try {
      const count = await storage.getUnrepliedTicketCount(req.session.userId!);
      res.json({ count });
    } catch (err) {
      res.json({ count: 0 });
    }
  });

  app.get("/api/admin/support/badge", requireAdmin, async (_req, res) => {
    try {
      const count = await storage.getOpenTicketCountForAdmin();
      res.json({ count });
    } catch (err) {
      res.json({ count: 0 });
    }
  });

  app.get("/api/admin/support/tickets", requireAdmin, async (_req, res) => {
    try {
      const tickets = await storage.getAllSupportTickets();
      const allUsers = await storage.getAllUsers();
      const allBots = await storage.getAllUserBots();
      const userMap = new Map(allUsers.map(u => [u.id, u]));
      const botMap = new Map(allBots.map(b => [b.userId, b]));
      const ticketsWithUser = tickets.map(t => ({
        ...t,
        user: userMap.get(t.userId),
        bot: botMap.get(t.userId),
      }));
      res.json(ticketsWithUser);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch tickets" });
    }
  });

  app.post("/api/admin/support/tickets/:id/status", requireAdmin, async (req, res) => {
    try {
      const { status } = req.body;
      await storage.updateTicketStatus(parseInt(req.params.id), status);
      res.json({ message: "Status updated" });
    } catch (err) {
      res.status(500).json({ message: "Failed to update status" });
    }
  });

  app.get("/api/announcements", async (_req, res) => {
    try {
      const anns = await storage.getActiveAnnouncements();
      res.json(anns);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch announcements" });
    }
  });

  app.post("/api/admin/announcements", requireAdmin, async (req, res) => {
    try {
      const { message, link } = req.body;
      if (!message) return res.status(400).json({ message: "Message is required" });
      const ann = await storage.createAnnouncement(message, link || undefined);
      res.json(ann);
    } catch (err) {
      res.status(500).json({ message: "Failed to create announcement" });
    }
  });

  app.delete("/api/admin/announcements/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteAnnouncement(parseInt(req.params.id));
      res.json({ message: "Announcement deleted" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete announcement" });
    }
  });

  app.get("/api/admin/announcements", requireAdmin, async (_req, res) => {
    try {
      const anns = await storage.getAllAnnouncements();
      res.json(anns);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch announcements" });
    }
  });

  return httpServer;
}
