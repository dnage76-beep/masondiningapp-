#!/bin/bash
# deploy-oracle.sh — Run this ON the Oracle Cloud VM as root (or with sudo).
# It installs everything, clones the repo, and starts the app behind Caddy (auto-HTTPS).
#
# Usage:
#   scp deploy-oracle.sh ubuntu@<VM_IP>:~
#   ssh ubuntu@<VM_IP>
#   chmod +x deploy-oracle.sh
#   sudo ./deploy-oracle.sh
#
# After running, set your domain's DNS A record to the VM's public IP,
# then edit /etc/caddy/Caddyfile to use your domain instead of :80.

set -euo pipefail

APP_DIR="/opt/masondining"
REPO_URL="https://github.com/dnage76-beep/masondiningapp-.git"

echo "=== 1. System packages ==="
apt-get update
apt-get install -y python3 python3-pip python3-venv git curl debian-keyring debian-archive-keyring apt-transport-https

echo "=== 2. Install Caddy (reverse proxy with auto-HTTPS) ==="
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy

echo "=== 3. Clone repo ==="
rm -rf "$APP_DIR"
git clone "$REPO_URL" "$APP_DIR"

echo "=== 4. Python venv + deps ==="
cd "$APP_DIR/backend"
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements-prod.txt

echo "=== 5. Create .env file ==="
if [ ! -f "$APP_DIR/backend/.env" ]; then
    cat > "$APP_DIR/backend/.env" <<'ENVEOF'
GMAIL_USER=dnage76@gmail.com
GMAIL_APP_PASSWORD=jxiw jggb mkky kbjl
# GEMINI_API_KEY=
# ALLOWED_ORIGIN=https://your-vercel-app.vercel.app
ENVEOF
    echo "Created .env — edit $APP_DIR/backend/.env to set ALLOWED_ORIGIN and GEMINI_API_KEY"
fi

echo "=== 6. Create systemd service ==="
cat > /etc/systemd/system/masondining.service <<'EOF'
[Unit]
Description=GMU Dining Tracker API
After=network.target

[Service]
Type=exec
User=www-data
Group=www-data
WorkingDirectory=/opt/masondining/backend
EnvironmentFile=/opt/masondining/backend/.env
ExecStart=/opt/masondining/backend/venv/bin/gunicorn app:app --bind 127.0.0.1:5001 --timeout 120 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

chown -R www-data:www-data "$APP_DIR"

systemctl daemon-reload
systemctl enable masondining
systemctl start masondining

echo "=== 7. Configure Caddy ==="
# Start with HTTP-only on port 80. Once you point a domain at this IP,
# replace ":80" with "yourdomain.com" and Caddy will auto-provision HTTPS.
cat > /etc/caddy/Caddyfile <<'EOF'
:80 {
    reverse_proxy 127.0.0.1:5001
}
EOF

systemctl restart caddy

echo "=== 8. Open firewall ports ==="
# iptables rules for Oracle Cloud (their security list also needs 80/443 opened in the web console)
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
netfilter-persistent save 2>/dev/null || iptables-save > /etc/iptables/rules.v4 2>/dev/null || true

echo ""
echo "=== DONE ==="
echo "Backend is running at http://$(curl -s ifconfig.me):80"
echo ""
echo "Next steps:"
echo "  1. In Oracle Cloud console: add ingress rules for ports 80 and 443 in your subnet's security list"
echo "  2. Test: curl http://<YOUR_VM_IP>/health"
echo "  3. For HTTPS: point a domain at this IP, then edit /etc/caddy/Caddyfile to replace ':80' with 'yourdomain.com'"
echo "  4. Update ALLOWED_ORIGIN in /opt/masondining/backend/.env to your Vercel frontend URL"
echo "  5. Restart: sudo systemctl restart masondining"
