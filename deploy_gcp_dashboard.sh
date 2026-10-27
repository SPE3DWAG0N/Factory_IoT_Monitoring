#!/bin/bash
# =============================================================================
# AETHER-PLANT SCADA — GCP Dashboard Deploy Script
# GCP equivalent of deploy_dashboard.sh (was rsync to EC2)
# Builds the React app locally and pushes it to Compute Engine via SCP/gcloud
#
# Usage: bash deploy_gcp_dashboard.sh <VM_IP> [path/to/ssh-key]
# =============================================================================
set -e

VM_IP="${1:-}"
KEY_FILE="${2:-~/.ssh/google_compute_engine}"
VM_USER="ubuntu"
REMOTE_DIR="/opt/aether-plant/dist"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DASHBOARD_DIR="$SCRIPT_DIR/dashboard"

if [ -z "$VM_IP" ]; then
  echo "Usage: $0 <VM_EXTERNAL_IP> [path/to/ssh-key]"
  echo "Example: $0 34.93.120.45 ~/.ssh/my-gcp-key"
  exit 1
fi

echo ""
echo "==================================================================="
echo "  AETHER-PLANT SCADA — GCP Dashboard Deployment Pipeline"
echo "  Target: $VM_USER@$VM_IP  |  Key: $KEY_FILE"
echo "==================================================================="
echo ""

# --- Step 1: Build React production bundle locally ---
echo "[1/4] Building React production bundle..."
cd "$DASHBOARD_DIR"
npm ci --silent
npm run build --silent
echo "  ✓ Build complete. Bundle size:"
du -sh dist/
echo ""

# --- Step 2: Ensure remote directory exists ---
echo "[2/4] Preparing remote Compute Engine VM..."
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "$VM_USER@$VM_IP" \
  "sudo mkdir -p $REMOTE_DIR && sudo chown -R ubuntu:ubuntu /opt/aether-plant"
echo "  ✓ Remote directory ready"
echo ""

# --- Step 3: Upload build artifacts via rsync ---
echo "[3/4] Uploading build artifacts to GCP VM..."
rsync -avz --delete \
  -e "ssh -i $KEY_FILE -o StrictHostKeyChecking=no" \
  "$DASHBOARD_DIR/dist/" \
  "$VM_USER@$VM_IP:$REMOTE_DIR/"
echo "  ✓ Upload complete"
echo ""

# --- Step 4: Restart SCADA service ---
echo "[4/4] Restarting SCADA service on GCP VM..."
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "$VM_USER@$VM_IP" \
  "sudo systemctl restart aether-scada && sudo systemctl status aether-scada --no-pager"
echo ""

echo "==================================================================="
echo "  ✅ GCP DASHBOARD DEPLOYMENT COMPLETE!"
echo "  Dashboard URL: http://$VM_IP/"
echo "==================================================================="
echo ""
