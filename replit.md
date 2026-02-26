# WhatsApp Bot Pairing Web Interface — LUCA Bot

A full-stack web platform for pairing WhatsApp bots using the Baileys library. Supports multi-user authentication, admin panel with system monitoring, IP-based abuse prevention, and maintenance mode.

## Features

- **User Authentication**: Register/login with email + password, sessions stored in PostgreSQL
- **IP-Based Abuse Prevention**: Max 3 accounts per IP address
- **Web-Based Pairing**: Enter phone number, receive pairing code, connect WhatsApp
- **User Dashboard**: Bot status, connect/disconnect, re-pair, change password
- **Admin Panel**: User management (ban/unban), bot restart/stop/restart-all, system stats (CPU/memory/uptime), maintenance mode toggle
- **Notifications**: In-app notification system with bell icon, unread count, mark read
- **Support Tickets**: User-facing support chat widget with ticket creation and real-time messaging; admin support ticket management with reply capability
- **Announcements**: Admin can create/delete announcements; users see dismissible banners on dashboard
- **Bot Auto-Start**: After pairing, bot.cjs is launched as a child process
- **Glassmorphism Design**: Split-screen auth pages, modern UI with Framer Motion animations and confetti celebrations

## Architecture

### Frontend
- React 18 with TypeScript
- Vite dev server, Tailwind CSS, shadcn/ui
- Framer Motion for animations, react-confetti
- React Query for API state, wouter for routing

### Backend
- Express.js with express-session (PostgreSQL store via connect-pg-simple)
- WhatsApp Baileys for bot pairing
- PostgreSQL database (Drizzle ORM)
- bcrypt for password hashing

## Database Schema (shared/schema.ts)

- **users**: id, email (unique), password (hashed), role, banned, registrationIp, createdAt
- **user_bots**: id, userId, phoneNumber, status, pairedAt
- **site_settings**: id, key (unique), value — for maintenance mode etc.
- **ip_tracking**: id, ipAddress, userId, action, createdAt
- **pairing_requests**: id, phoneNumber, status, pairingCode, userId, createdAt
- **notifications**: id, userId, title, message, type, read, createdAt
- **support_tickets**: id, userId, subject, status, createdAt
- **support_messages**: id, ticketId, senderId, senderRole, message, createdAt
- **announcements**: id, message, active, createdAt

## Key Files

### Backend
- `server/index.ts` - Express server with session middleware
- `server/routes.ts` - All API endpoints (auth, pairing, bot, admin, notifications, support, announcements)
- `server/pairing.ts` - WhatsApp Baileys pairing logic + bot process management
- `server/storage.ts` - Database operations (IStorage interface)
- `server/db.ts` - Database connection pool
- `shared/schema.ts` - Drizzle schema, Zod validation schemas, types

### Frontend
- `client/src/App.tsx` - Router with protected/admin routes
- `client/src/pages/Login.tsx` - Split-screen login page with feature showcase
- `client/src/pages/Register.tsx` - Split-screen registration with benefits list
- `client/src/pages/Dashboard.tsx` - User dashboard with pairing flow, notifications, support chat, announcements
- `client/src/pages/Admin.tsx` - Admin panel (overview, users, system, support, announcements tabs)
- `client/src/pages/Maintenance.tsx` - Maintenance mode page
- `client/src/hooks/use-auth.ts` - Auth context hook
- `client/src/hooks/use-pairing.ts` - Pairing logic hook
- `client/src/index.css` - Global styles, theme, glassmorphism

### Bot
- `bot.cjs` - WhatsApp bot (CommonJS, 6300+ lines), spawned after pairing
- Requires: sharp, axios, yt-search (youtube-dl-exec optional)

## API Endpoints

### Auth
- POST `/api/auth/register` — Register (email, password, confirmPassword)
- POST `/api/auth/login` — Login (email, password)
- POST `/api/auth/logout` — Logout
- GET `/api/auth/me` — Current user info + maintenance status
- POST `/api/auth/change-password` — Change password (auth required)

### Bot
- GET `/api/bot/status` — Current user's bot status (auth required)
- POST `/api/bot/disconnect` — Disconnect bot (auth required)
- POST `/api/pairing/request` — Start pairing (auth required, body: {phoneNumber})
- GET `/api/pairing/status/:phone` — Poll pairing status

### Notifications
- GET `/api/notifications` — User's notifications with unread count
- POST `/api/notifications/:id/read` — Mark single notification as read
- POST `/api/notifications/read-all` — Mark all notifications as read

### Support
- GET `/api/support/tickets` — User's support tickets
- POST `/api/support/tickets` — Create ticket (subject, message)
- GET `/api/support/tickets/:id/messages` — Get ticket messages
- POST `/api/support/tickets/:id/messages` — Send message on ticket

### Announcements
- GET `/api/announcements` — Active announcements (public)

### Admin
- GET `/api/admin/users` — All users with bot info
- POST `/api/admin/users/:id/ban` — Ban/unban user
- POST `/api/admin/bot/:userId/restart` — Restart user's bot
- POST `/api/admin/bot/:userId/stop` — Stop user's bot
- POST `/api/admin/bots/restart-all` — Restart all active bots
- GET `/api/admin/system` — System stats (memory, CPU, uptime)
- GET/POST `/api/admin/maintenance` — Get/toggle maintenance mode
- GET `/api/admin/support/tickets` — All support tickets with user info
- POST `/api/admin/support/tickets/:id/status` — Update ticket status
- GET/POST `/api/admin/announcements` — Get all / create announcement
- DELETE `/api/admin/announcements/:id` — Delete announcement

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Express session secret

## Default Admin Account

On first startup: onlyidledev@gmail.com / isr828u2
