# LUCA Bot - VPS Deployment Guide

## Quick Setup (5 minutes)

### Step 1: SSH into your VPS
```bash
ssh root@YOUR_DROPLET_IP
```

### Step 2: Clone the repo
```bash
cd /opt
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git luca-bot
cd luca-bot
```

### Step 3: Run the deployment script
```bash
chmod +x vps/deploy.sh
sudo bash vps/deploy.sh
```

That's it! The script handles everything:
- Installs Node.js 20, PM2, Nginx, PostgreSQL
- Builds the frontend
- Generates secure API keys and session secrets
- Sets up PM2 with auto-restart
- Configures Nginx reverse proxy
- Sets up the firewall

### Step 4: Access your app
Open `http://YOUR_DROPLET_IP` in your browser.

Default admin login: `admin@luca.bot` / `admin123`
**Change this password immediately!**

---

## Adding a Custom Domain + SSL

If you have a domain (e.g., luca.yourdomain.com):

1. Point your domain's DNS A record to your droplet IP
2. Run:
```bash
sudo certbot --nginx -d luca.yourdomain.com
```

---

## Useful Commands

```bash
# Check status of all processes
pm2 status

# View logs
pm2 logs              # All logs
pm2 logs luca-web     # Web server only
pm2 logs luca-bots    # Bot manager only

# Restart
pm2 restart all       # Restart everything
pm2 restart luca-web  # Restart web server only
pm2 restart luca-bots # Restart bot manager only

# Monitor (live dashboard)
pm2 monit

# Update after code changes
cd /opt/luca-bot
git pull
npm install
npm run build
pm2 restart all
```

---

## Architecture on VPS

```
Nginx (port 80/443) → Express Web App (port 5000)
                     → Bot Manager API (port 3500, internal only)

PM2 manages:
  ├── luca-web  (Express server - handles auth, dashboard, admin, pairing)
  └── luca-bots (Bot manager - manages WhatsApp bot instances)
        ├── Bot for user1 (phone: xxx)
        ├── Bot for user2 (phone: yyy)
        └── Bot for user3 (phone: zzz)
```

---

## Environment Variables (.env)

Located at `/opt/luca-bot/.env`:

| Variable | Description |
|---|---|
| NODE_ENV | production |
| PORT | 5000 (web server) |
| DATABASE_URL | PostgreSQL connection string |
| SESSION_SECRET | Auto-generated session encryption key |
| BOT_MANAGER_API_KEY | Auto-generated API key for bot manager |
| VPS_URL | http://localhost:3500 (bot manager URL) |
| VPS_API_KEY | Same as BOT_MANAGER_API_KEY |
