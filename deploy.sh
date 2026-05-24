#!/bin/bash
set -e

# Load NVM/Node path for non-interactive SSH sessions
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
export PATH="$HOME/.local/share/pnpm:$HOME/.nvm/versions/node/$(node -v 2>/dev/null || echo v20)/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

APP_DIR="/var/www/conveyai-backend"
cd "$APP_DIR"

echo "📦 Installing pnpm if not present..."
if ! command -v pnpm &> /dev/null; then
  npm install -g pnpm
fi

echo "📥 Installing production dependencies..."
pnpm install --prod --frozen-lockfile

echo "🔄 Reloading Caddy configuration..."
if [ -f "$APP_DIR/Caddyfile" ]; then
  sudo cp "$APP_DIR/Caddyfile" /etc/caddy/Caddyfile
  sudo systemctl reload caddy
fi

echo "🚀 Restarting PM2 process..."
if pm2 list | grep -q "conveyai-backend"; then
  pm2 restart ecosystem.config.js
else
  pm2 start ecosystem.config.js
fi

pm2 save

echo "✅ Deployment complete!"
