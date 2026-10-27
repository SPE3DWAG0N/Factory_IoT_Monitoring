#!/bin/bash
# =============================================================================
# AETHER-PLANT SCADA — Fast Dashboard Deploy Script
# Builds the React app locally and pushes it to EC2 via SCP/rsync
# Usage: bash deploy_dashboard.sh <EC2_PUBLIC_IP> [path/to/key.pem]
# =============================================================================
set -e

EC2_IP="${1:-}"
KEY_FILE="${2:-~/.ssh/id_rsa}"
EC2_USER="ubuntu"
REMOTE_DIR="/opt/aether-plant/dist"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DASHBOARD_DIR="$SCRIPT_DIR/dashboard"

if [ -z "$EC2_IP" ]; then
  echo "Usage: $0 <EC2_PUBLIC_IP> [path/to/key.pem]"
  echo "Example: $0 13.235.120.45 ~/Downloads/plant-key.pem"
  exit 1
fi

echo ""
echo "==================================================================="
echo "  AETHER-PLANT SCADA — Cloud Deployment Pipeline"
echo "  Target: ubuntu@$EC2_IP  |  Key: $KEY_FILE"
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
echo "[2/4] Preparing remote server..."
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_IP" \
  "sudo mkdir -p $REMOTE_DIR && sudo chown -R ubuntu:ubuntu /opt/aether-plant"
echo "  ✓ Remote directory ready"
echo ""

# --- Step 3: Upload build artifacts via rsync ---
echo "[3/4] Uploading build artifacts to EC2..."
rsync -avz --delete \
  -e "ssh -i $KEY_FILE -o StrictHostKeyChecking=no" \
  "$DASHBOARD_DIR/dist/" \
  "$EC2_USER@$EC2_IP:$REMOTE_DIR/"
echo "  ✓ Upload complete"
echo ""

# --- Step 4: Restart service on EC2 ---
echo "[4/4] Restarting SCADA service on EC2..."
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_IP" \
  "sudo systemctl restart aether-scada && sudo systemctl status aether-scada --no-pager"
echo ""

echo "==================================================================="
echo "  ✅ DEPLOYMENT COMPLETE!"
echo "  Dashboard URL: http://$EC2_IP/"
echo "==================================================================="
echo ""
