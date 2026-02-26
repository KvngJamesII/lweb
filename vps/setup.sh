#!/bin/bash
set -e

echo "========================================="
echo "  LUCA Bot Manager - VPS Setup Script"
echo "========================================="
echo ""

# Update system
echo "[1/7] Updating system packages..."
apt update && apt upgrade -y

# Install Node.js 20 LTS
echo "[2/7] Installing Node.js 20 LTS..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"

# Install PM2 globally
echo "[3/7] Installing PM2..."
npm install -g pm2

# Install build essentials for sharp
echo "[4/7] Installing build tools..."
apt install -y build-essential python3

# Create app directory
echo "[5/7] Setting up application directory..."
APP_DIR="/opt/luca-bot-manager"
mkdir -p $APP_DIR
cd $APP_DIR

# Copy files (this script assumes files are already in current dir or will be copied)
echo "[6/7] Installing dependencies..."
if [ ! -f "package.json" ]; then
    echo "ERROR: package.json not found in $APP_DIR"
    echo "Please copy the vps/ folder contents to $APP_DIR first"
    exit 1
fi
npm install

# Generate API key if not set
if [ -z "$BOT_MANAGER_API_KEY" ]; then
    API_KEY=$(openssl rand -hex 32)
    echo ""
    echo "========================================="
    echo "  Generated API Key (SAVE THIS!):"
    echo "  $API_KEY"
    echo "========================================="
    echo ""

    # Create .env file
    cat > .env << EOF
BOT_MANAGER_API_KEY=$API_KEY
BOT_MANAGER_PORT=3500
EOF
    echo "API key saved to .env file"
fi

# Setup PM2 ecosystem file
echo "[7/7] Creating PM2 config..."
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'luca-manager',
    script: 'bot-manager.js',
    cwd: '/opt/luca-bot-manager',
    env_file: '.env',
    node_args: '--max-old-space-size=6144',
    max_memory_restart: '6G',
    restart_delay: 3000,
    max_restarts: 10,
    autorestart: true,
    watch: false,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '/opt/luca-bot-manager/logs/error.log',
    out_file: '/opt/luca-bot-manager/logs/output.log',
    merge_logs: true,
  }]
};
EOF

mkdir -p logs

# Setup UFW firewall
echo ""
echo "Setting up firewall..."
ufw allow 22/tcp
ufw allow 3500/tcp
ufw --force enable

echo ""
echo "========================================="
echo "  Setup Complete!"
echo "========================================="
echo ""
echo "To start the bot manager:"
echo "  cd /opt/luca-bot-manager"
echo "  source .env && export BOT_MANAGER_API_KEY BOT_MANAGER_PORT"
echo "  pm2 start ecosystem.config.js"
echo "  pm2 save"
echo "  pm2 startup"
echo ""
echo "Useful commands:"
echo "  pm2 logs luca-manager    - View logs"
echo "  pm2 restart luca-manager - Restart manager"
echo "  pm2 status               - Check status"
echo ""
echo "Don't forget to set VPS_URL and VPS_API_KEY in your Replit secrets!"
echo ""
