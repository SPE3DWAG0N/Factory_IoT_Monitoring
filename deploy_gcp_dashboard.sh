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

  echo "[2/4] Preparing remote Compute Engine VM via SSH ($VM_IP)..."
  ssh $KEY_FLAG -o StrictHostKeyChecking=no "$VM_USER@$VM_IP" \
    "sudo mkdir -p $REMOTE_DIR && sudo chown -R ubuntu:ubuntu /opt/aether-plant"
  echo "  ✓ Remote directory ready"
  echo ""

  echo "[3/4] Uploading build artifacts to GCP VM ($VM_IP)..."
  if command -v rsync >/dev/null 2>&1; then
    rsync -avz --delete \
      -e "ssh $KEY_FLAG -o StrictHostKeyChecking=no" \
      "$DASHBOARD_DIR/dist/" \
      "$VM_USER@$VM_IP:$REMOTE_DIR/"
  else
    scp $KEY_FLAG -r -o StrictHostKeyChecking=no "$DASHBOARD_DIR/dist/"* "$VM_USER@$VM_IP:$REMOTE_DIR/"
  fi
  echo "  ✓ Upload complete"
  echo ""

  echo "[4/4] Restarting SCADA service on GCP VM..."
  ssh $KEY_FLAG -o StrictHostKeyChecking=no "$VM_USER@$VM_IP" \
    "sudo systemctl restart aether-scada && sudo systemctl status aether-scada --no-pager"

  echo ""
  echo "==================================================================="
  echo "  ✅ GCP DASHBOARD DEPLOYMENT COMPLETE!"
  echo "  Dashboard URL: http://$VM_IP/"
  echo "==================================================================="

else
  # Target is instance name -> use gcloud compute scp/ssh
  ZONE="${ARG2:-asia-south1-a}"
  INSTANCE="$TARGET"

  echo "[2/4] Preparing remote Compute Engine VM via gcloud ($INSTANCE in $ZONE)..."
  gcloud compute ssh "$INSTANCE" --zone="$ZONE" --command="sudo mkdir -p $REMOTE_DIR && sudo chown -R ubuntu:ubuntu /opt/aether-plant" --quiet
  echo "  ✓ Remote directory ready"
  echo ""

  echo "[3/4] Uploading build artifacts via gcloud compute scp..."
  gcloud compute scp --recurse "$DASHBOARD_DIR/dist/"* "$INSTANCE:$REMOTE_DIR/" --zone="$ZONE" --quiet
  echo "  ✓ Upload complete"
  echo ""

  echo "[4/4] Restarting SCADA service on GCP VM..."
  gcloud compute ssh "$INSTANCE" --zone="$ZONE" --command="sudo systemctl restart aether-scada && sudo systemctl status aether-scada --no-pager" --quiet

  VM_IP=$(gcloud compute instances describe "$INSTANCE" --zone="$ZONE" --format="get(networkInterfaces[0].accessConfigs[0].natIP)" 2>/dev/null || echo "<pending>")

  echo ""
  echo "==================================================================="
  echo "  ✅ GCP DASHBOARD DEPLOYMENT COMPLETE!"
  echo "  Dashboard URL: http://$VM_IP/"
  echo "==================================================================="
fi
