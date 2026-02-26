# WhatsApp Bot Pairing Web Interface — LUCA Bot

A full-stack web platform for pairing WhatsApp bots using the Baileys library. Supports multi-user authentication, admin panel with system monitoring, IP-based abuse prevention, and maintenance mode.

## Features

- **User Authentication**: Register/login with email + password, sessions stored in PostgreSQL
- **IP-Based Abuse Prevention**: Max 3 accounts per IP address
- **Web-Based Pairing**: Enter phone number, receive pairing code, connect WhatsApp
- **User Dashboard**: Bot status, connect/disconnect, re-pair, change password
- **Admin Panel**: User management (ban/unban), bot restart/stop, system stats (CPU/memory/uptime), maintenance mode toggle
- **Bot Auto-Start**: After pairing, bot.cjs is launched as a child process
- **Glassmorphism Design**: Modern UI with Framer Motion animations and confetti celebrations

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

## Key Files

### Backend
- `server/index.ts` - Express server with session middleware
- `server/routes.ts` - All API endpoints (auth, pairing, bot, admin)
- `server/pairing.ts` - WhatsApp Baileys pairing logic + bot process management
- `server/storage.ts` - Database operations (IStorage interface)
- `server/db.ts` - Database connection pool
- `shared/schema.ts` - Drizzle schema, Zod validation schemas, types

### Frontend
- `client/src/App.tsx` - Router with protected/admin routes
- `client/src/pages/Login.tsx` - Login page
- `client/src/pages/Register.tsx` - Registration page
- `client/src/pages/Dashboard.tsx` - User dashboard with pairing flow
- `client/src/pages/Admin.tsx` - Admin panel (overview, users, system tabs)
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

### Admin
- GET `/api/admin/users` — All users with bot info
- POST `/api/admin/users/:id/ban` — Ban/unban user
- POST `/api/admin/bot/:userId/restart` — Restart user's bot
- POST `/api/admin/bot/:userId/stop` — Stop user's bot
- GET `/api/admin/system` — System stats (memory, CPU, uptime)
- GET/POST `/api/admin/maintenance` — Get/toggle maintenance mode

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Express session secret

## Default Admin Account

On first startup: admin@luca.bot / admin123
