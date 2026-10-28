#!/bin/bash
# =============================================================================
# AETHER-PLANT SCADA — GCP Dashboard Deploy Script
# Builds the React app locally and deploys it to the Compute Engine VM
#
# Usage:
#   Option A (via gcloud CLI - recommended, handles SSH automatically):
#     bash deploy_gcp_dashboard.sh [plant-scada-server] [asia-south1-a]
#
#   Option B (via Direct SSH/SCP):
#     bash deploy_gcp_dashboard.sh <VM_EXTERNAL_IP> [path/to/ssh-key]
# =============================================================================
set -e

# Load NVM (Node Version Manager) in non-interactive shells like Cloud Shell
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
elif [ -s "/usr/local/nvm/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "/usr/local/nvm/nvm.sh"
fi

TARGET="${1:-plant-scada-server}"
ARG2="${2:-}"
VM_USER="ubuntu"
REMOTE_DIR="/opt/aether-plant/dist"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DASHBOARD_DIR="$SCRIPT_DIR/dashboard"

echo ""
echo "==================================================================="
echo "  AETHER-PLANT SCADA — GCP Dashboard Deployment Pipeline"
echo "  Target: $TARGET"
echo "==================================================================="
echo ""

# --- Step 1: Build React production bundle locally ---
echo "[1/4] Preparing React production bundle..."
cd "$DASHBOARD_DIR"

if command -v npm >/dev/null 2>&1; then
  if [ -f "package-lock.json" ]; then
    npm ci --silent 2>/dev/null || npm install --silent
  else
    npm install --silent
  fi
  npm run build
  echo "  ✓ Build complete."
elif [ -f "dist/index.html" ]; then
  echo "  ✓ Using pre-built production bundle from dashboard/dist."
else
  echo "[-] npm not found and dashboard/dist not found. Please install node/npm."
  exit 1
fi
echo ""

# --- Determine deployment mode ---
if [[ "$TARGET" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  # Target is an IP address -> use SCP / SSH
  VM_IP="$TARGET"
  KEY_FLAG=""
  if [ -n "$ARG2" ] && [ -f "$ARG2" ]; then
    KEY_FLAG="-i $ARG2"
  fi

  echo "[2/4] Preparing remote directories via SSH ($VM_IP)..."
  ssh $KEY_FLAG -o StrictHostKeyChecking=no "$VM_USER@$VM_IP" \
    "mkdir -p ~/dashboard_staging && sudo mkdir -p $REMOTE_DIR"
  echo "  ✓ Staging ready"
  echo ""

  echo "[3/4] Uploading build artifacts to VM ($VM_IP)..."
  scp $KEY_FLAG -r -o StrictHostKeyChecking=no "$DASHBOARD_DIR/dist" "$VM_USER@$VM_IP:~/dashboard_staging/"
  ssh $KEY_FLAG -o StrictHostKeyChecking=no "$VM_USER@$VM_IP" \
    "sudo cp -r ~/dashboard_staging/dist/* $REMOTE_DIR/ && sudo chmod -R 755 /opt/aether-plant && rm -rf ~/dashboard_staging"
  echo "  ✓ Upload complete"
  echo ""

  echo "[4/4] Configuring & starting SCADA service on GCP VM..."
  ssh $KEY_FLAG -o StrictHostKeyChecking=no "$VM_USER@$VM_IP" 'bash -s' << 'EOF'
    sudo systemctl stop nginx 2>/dev/null || true
    sudo systemctl disable nginx 2>/dev/null || true
    sudo rm -f /usr/local/bin/serve
    SERVE_PATH=$(which serve || command -v serve || ls /usr/bin/serve 2>/dev/null || echo "")
    if [ -z "$SERVE_PATH" ] || [ ! -f "$SERVE_PATH" ]; then
      sudo npm install -g serve --loglevel=error
      SERVE_PATH=$(which serve || command -v serve || ls /usr/bin/serve 2>/dev/null)
    fi
    sudo tee /etc/systemd/system/aether-scada.service > /dev/null << SVCEOF
[Unit]
Description=Aether Plant SCADA Industrial Monitoring Service (GCP)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/aether-plant
ExecStart=$SERVE_PATH -s /opt/aether-plant/dist -l 80
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCEOF
    sudo systemctl daemon-reload
    sudo systemctl restart aether-scada
    sleep 1
    sudo systemctl status aether-scada --no-pager
EOF

  echo ""
  echo "==================================================================="
  echo "  ✅ GCP DASHBOARD DEPLOYMENT COMPLETE!"
  echo "  Dashboard URL: http://$VM_IP/"
  echo "==================================================================="

else
  # Target is instance name -> use gcloud compute scp/ssh
  ZONE="${ARG2:-asia-south1-a}"
  INSTANCE="$TARGET"

  echo "[2/4] Preparing remote staging on Compute Engine VM ($INSTANCE in $ZONE)..."
  gcloud compute ssh "$INSTANCE" --zone="$ZONE" \
    --command="mkdir -p ~/dashboard_staging && sudo mkdir -p $REMOTE_DIR" --quiet
  echo "  ✓ Staging ready"
  echo ""

  echo "[3/4] Uploading build artifacts via gcloud compute scp..."
  gcloud compute scp --recurse "$DASHBOARD_DIR/dist" "$INSTANCE:~/dashboard_staging/" --zone="$ZONE" --quiet
  gcloud compute ssh "$INSTANCE" --zone="$ZONE" \
    --command="sudo cp -r ~/dashboard_staging/dist/* $REMOTE_DIR/ && sudo chmod -R 755 /opt/aether-plant && rm -rf ~/dashboard_staging" --quiet
  echo "  ✓ Upload complete"
  echo ""

  echo "[4/4] Configuring & starting SCADA service on GCP VM..."
  gcloud compute ssh "$INSTANCE" --zone="$ZONE" --command='
    sudo systemctl stop nginx 2>/dev/null || true
    sudo systemctl disable nginx 2>/dev/null || true
    sudo rm -f /usr/local/bin/serve
    SERVE_PATH=$(which serve || command -v serve || ls /usr/bin/serve 2>/dev/null || echo "")
    if [ -z "$SERVE_PATH" ] || [ ! -f "$SERVE_PATH" ]; then
      sudo npm install -g serve --loglevel=error
      SERVE_PATH=$(which serve || command -v serve || ls /usr/bin/serve 2>/dev/null)
    fi
    sudo tee /etc/systemd/system/aether-scada.service > /dev/null << SVCEOF
[Unit]
Description=Aether Plant SCADA Industrial Monitoring Service (GCP)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/aether-plant
ExecStart=$SERVE_PATH -s /opt/aether-plant/dist -l 80
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCEOF
    sudo systemctl daemon-reload
    sudo systemctl restart aether-scada
    sleep 1
    sudo systemctl status aether-scada --no-pager
  ' --quiet

  VM_IP=$(gcloud compute instances describe "$INSTANCE" --zone="$ZONE" --format="get(networkInterfaces[0].accessConfigs[0].natIP)" 2>/dev/null || echo "<pending>")

  echo ""
  echo "==================================================================="
  echo "  ✅ GCP DASHBOARD DEPLOYMENT COMPLETE!"
  echo "  Dashboard URL: http://$VM_IP/"
  echo "==================================================================="
fi
