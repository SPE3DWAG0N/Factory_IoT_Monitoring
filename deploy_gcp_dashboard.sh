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
echo "[1/4] Building React production bundle..."
cd "$DASHBOARD_DIR"
if [ -f "package-lock.json" ]; then
  npm ci --silent
else
  npm install --silent
fi
npm run build
echo "  ✓ Build complete."
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

  echo "[4/4] Ensuring serve binary and restarting SCADA service on GCP VM..."
  ssh $KEY_FLAG -o StrictHostKeyChecking=no "$VM_USER@$VM_IP" "bash -s" << 'EOF'
    if ! command -v serve >/dev/null 2>&1 && [ ! -f /usr/local/bin/serve ] && [ ! -f /usr/bin/serve ]; then
      sudo npm install -g serve --loglevel=error
    fi
    SERVE_BIN=$(which serve || command -v serve || ls /usr/bin/serve /usr/local/bin/serve 2>/dev/null | head -n 1)
    if [ -n "$SERVE_BIN" ]; then
      sudo ln -sf "$SERVE_BIN" /usr/local/bin/serve 2>/dev/null || true
      sudo ln -sf "$SERVE_BIN" /usr/bin/serve 2>/dev/null || true
    fi
    sudo systemctl daemon-reload
    sudo systemctl restart aether-scada
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

  echo "[4/4] Ensuring serve binary and restarting SCADA service on GCP VM..."
  gcloud compute ssh "$INSTANCE" --zone="$ZONE" --command='
    if ! command -v serve >/dev/null 2>&1 && [ ! -f /usr/local/bin/serve ] && [ ! -f /usr/bin/serve ]; then
      sudo npm install -g serve --loglevel=error
    fi
    SERVE_BIN=$(which serve || command -v serve || ls /usr/bin/serve /usr/local/bin/serve 2>/dev/null | head -n 1)
    if [ -n "$SERVE_BIN" ]; then
      sudo ln -sf "$SERVE_BIN" /usr/local/bin/serve 2>/dev/null || true
      sudo ln -sf "$SERVE_BIN" /usr/bin/serve 2>/dev/null || true
    fi
    sudo systemctl daemon-reload
    sudo systemctl restart aether-scada
    sudo systemctl status aether-scada --no-pager
  ' --quiet

  VM_IP=$(gcloud compute instances describe "$INSTANCE" --zone="$ZONE" --format="get(networkInterfaces[0].accessConfigs[0].natIP)" 2>/dev/null || echo "<pending>")

  echo ""
  echo "==================================================================="
  echo "  ✅ GCP DASHBOARD DEPLOYMENT COMPLETE!"
  echo "  Dashboard URL: http://$VM_IP/"
  echo "==================================================================="
fi
