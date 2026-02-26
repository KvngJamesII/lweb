# WhatsApp Bot Pairing Web Interface

A modern web application that allows users to pair their WhatsApp accounts with a bot through a clean, browser-based interface — replacing the need for a Telegram bot.

## Features

- **Web-based pairing**: Users enter their phone number to receive a pairing code
- **Real-time status updates**: Polls backend to detect successful connection
- **WhatsApp Baileys integration**: Uses @whiskeysockets/baileys for WhatsApp Web protocol
- **PostgreSQL storage**: Tracks pairing requests and connection status
- **Modern React frontend**: Built with TypeScript, Tailwind CSS, and Framer Motion

## Architecture

### Frontend
- React 18 with TypeScript
- Vite for development and building
- Tailwind CSS for styling
- Framer Motion for animations
- React Query for API state management

### Backend
- Express.js server
- TypeScript with ES modules
- WhatsApp Baileys for bot pairing
- PostgreSQL database (Drizzle ORM)
- Pino for logging

## Key Files

### Backend
- `server/routes.ts` - API endpoints for pairing requests and status checks
- `server/pairing.ts` - WhatsApp Baileys pairing logic
- `server/storage.ts` - Database operations
- `server/db.ts` - Database connection
- `shared/schema.ts` - Database schema and types
- `shared/routes.ts` - API contract definitions

### Frontend
- `client/src/App.tsx` - Main application component
- `client/src/pages/Home.tsx` - Pairing interface
- `client/src/hooks/use-pairing.ts` - Pairing logic hook
- `client/src/index.css` - Global styles and theme

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string (auto-configured by Replit)

## API Endpoints

### POST `/api/pairing/request`
Request a pairing code for a phone number.

**Request body:**
```json
{
  "phoneNumber": "1234567890"
}
```

**Response:**
```json
{
  "code": "ABCD1234",
  "status": "code_generated"
}
```

### GET `/api/pairing/status/:phone`
Check the connection status for a phone number.

**Response:**
```json
{
  "status": "connected"
}
```

## How It Works

1. User enters their phone number (with country code)
2. Frontend sends POST request to `/api/pairing/request`
3. Backend creates a WhatsApp socket and requests a pairing code
4. Pairing code is returned to the frontend and displayed
5. User enters the code in WhatsApp on their phone
6. Frontend polls `/api/pairing/status/:phone` every 3 seconds
7. When status becomes "connected", success message is shown
8. Bot credentials are saved in `users/user_{phone}/auth_info/`

## User Data Storage

Each paired user gets a directory at `users/user_{phoneNumber}/` containing:
- `auth_info/` - WhatsApp authentication credentials
- `bot_data.json` - Bot configuration and settings

## Development

Run the application:
```bash
npm run dev
```

The server will start on port 5000 with the frontend served by Vite.

## Dependencies

Key packages:
- `@whiskeysockets/baileys` - WhatsApp Web API
- `express` - Web server
- `drizzle-orm` - Database ORM
- `pg` - PostgreSQL client
- `pino` - Logging
- `react` - UI library
- `framer-motion` - Animations
