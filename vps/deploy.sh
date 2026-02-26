#!/bin/bash
set -e

echo "========================================="
echo "  LUCA Bot - Full Stack VPS Deployment"
echo "========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root: sudo bash deploy.sh"
  exit 1
fi

# Update system
echo "[1/8] Updating system..."
apt update && apt upgrade -y

# Install Node.js 20 LTS
echo "[2/8] Installing Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
echo "  Node: $(node -v) | npm: $(npm -v)"

# Install build tools + PM2
echo "[3/8] Installing PM2 and build tools..."
npm install -g pm2
apt install -y build-essential python3 git nginx certbot python3-certbot-nginx -y

# Setup app directory
echo "[4/8] Setting up application..."
APP_DIR="/opt/luca-bot"
mkdir -p $APP_DIR

# Check if files exist (either cloned from git or uploaded)
if [ ! -f "$APP_DIR/package.json" ]; then
    echo ""
    echo "  App files not found in $APP_DIR"
    echo "  Please clone your repo first:"
    echo "    cd /opt/luca-bot && git clone <your-repo-url> ."
    echo "  Or upload the files via SCP"
    echo ""
    exit 1
fi

cd $APP_DIR

# Install dependencies
echo "[5/8] Installing dependencies..."
npm install
YOUTUBE_DL_SKIP_PYTHON_CHECK=1 npm install youtube-dl-exec 2>/dev/null || true

# Build the frontend
echo "[6/8] Building frontend..."
npm run build

# Generate secrets if not exist
echo "[7/8] Configuring environment..."
ENV_FILE="$APP_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
    SESSION_SECRET=$(openssl rand -hex 32)
    BOT_API_KEY=$(openssl rand -hex 32)

    cat > $ENV_FILE << EOF
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://localhost:5432/luca_bot
SESSION_SECRET=$SESSION_SECRET
BOT_MANAGER_API_KEY=$BOT_API_KEY
VPS_URL=http://localhost:3500
VPS_API_KEY=$BOT_API_KEY
EOF

    echo ""
    echo "  ================================================"
    echo "  Environment file created at $ENV_FILE"
    echo "  IMPORTANT: Edit DATABASE_URL if using external DB"
    echo "  ================================================"
    echo ""
fi

# Install PostgreSQL if not present
if ! command -v psql &> /dev/null; then
    echo "  Installing PostgreSQL..."
    apt install -y postgresql postgresql-contrib
    systemctl start postgresql
    systemctl enable postgresql

    # Create database and user
    sudo -u postgres psql -c "CREATE DATABASE luca_bot;" 2>/dev/null || true
    sudo -u postgres psql -c "CREATE USER luca WITH PASSWORD 'luca_secure_pass_123';" 2>/dev/null || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE luca_bot TO luca;" 2>/dev/null || true
    sudo -u postgres psql -c "ALTER DATABASE luca_bot OWNER TO luca;" 2>/dev/null || true

    # Update .env with local DB
    sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgresql://luca:luca_secure_pass_123@localhost:5432/luca_bot|" $ENV_FILE
    echo "  PostgreSQL installed. DB: luca_bot, User: luca"
fi

# Push database schema
echo "  Pushing database schema..."
set -a; source $ENV_FILE; set +a
npx drizzle-kit push 2>/dev/null || npm run db:push 2>/dev/null || true

# Create bots directory for bot manager
mkdir -p $APP_DIR/bots
mkdir -p $APP_DIR/logs

# Setup PM2 ecosystem
echo "[8/8] Setting up PM2..."
cat > $APP_DIR/ecosystem.config.cjs << 'PMEOF'
module.exports = {
  apps: [
    {
      name: 'luca-web',
      script: 'dist/index.js',
      cwd: '/opt/luca-bot',
      env_file: '.env',
      node_args: '--max-old-space-size=2048',
      max_memory_restart: '2G',
      restart_delay: 3000,
      max_restarts: 10,
      autorestart: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/opt/luca-bot/logs/web-error.log',
      out_file: '/opt/luca-bot/logs/web-output.log',
      merge_logs: true,
    },
    {
      name: 'luca-bots',
      script: 'vps/bot-manager.js',
      cwd: '/opt/luca-bot',
      env_file: '.env',
      node_args: '--max-old-space-size=6144',
      max_memory_restart: '6G',
      restart_delay: 3000,
      max_restarts: 10,
      autorestart: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/opt/luca-bot/logs/bots-error.log',
      out_file: '/opt/luca-bot/logs/bots-output.log',
      merge_logs: true,
    }
  ]
};
PMEOF

# Load env and start PM2
set -a; source $ENV_FILE; set +a
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root

# Setup Nginx reverse proxy
echo "Setting up Nginx..."
cat > /etc/nginx/sites-available/luca-bot << 'NGINXEOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/luca-bot /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# Setup firewall
echo "Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo ""
echo "========================================="
echo "  Deployment Complete!"
echo "========================================="
echo ""
echo "  Your app is running at: http://$(curl -s ifconfig.me)"
echo ""
echo "  Useful commands:"
echo "    pm2 status              - Check processes"
echo "    pm2 logs                - View all logs"
echo "    pm2 logs luca-web       - Web server logs"
echo "    pm2 logs luca-bots      - Bot manager logs"
echo "    pm2 restart all         - Restart everything"
echo ""
echo "  To add SSL (HTTPS) with a domain:"
echo "    certbot --nginx -d yourdomain.com"
echo ""
echo "  Default admin: admin@luca.bot / admin123"
echo "  CHANGE THIS PASSWORD after first login!"
echo ""
