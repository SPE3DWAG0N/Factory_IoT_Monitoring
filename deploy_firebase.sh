#!/bin/bash
set -e

# Load NVM (Node Version Manager) in Cloud Shell / non-interactive shells
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
elif [ -s "/usr/local/nvm/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "/usr/local/nvm/nvm.sh"
fi

PROJECT_ID="${1:-project-be0d8aa3-b99b-4b14-953}"
SITE_NAME="${2:-factory-iot-monitoring-2026}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export CLOUDSDK_CORE_PROJECT="$PROJECT_ID"
gcloud config set project "$PROJECT_ID" --quiet 2>/dev/null || true

echo "==================================================================="
echo "  Deploying SCADA Dashboard to Custom Firebase Site"
echo "  Target URL: https://${SITE_NAME}.web.app"
echo "  Project:    $PROJECT_ID"
echo "==================================================================="

# 1. Enable Firebase APIs
echo "[1/3] Enabling Firebase APIs..."
gcloud services enable firebase.googleapis.com firebasehosting.googleapis.com --project="$PROJECT_ID" --quiet

# 2. Build fresh React production bundle
echo "[2/3] Building fresh React production bundle..."
cd "$SCRIPT_DIR/dashboard"
if command -v npm >/dev/null 2>&1; then
  npm run build
else
  echo "npm not detected, using pre-built dist bundle."
fi

# 3. Deploy directly to the custom site
echo "[3/3] Deploying files to https://${SITE_NAME}.web.app..."
cd "$SCRIPT_DIR"
npx -y firebase-tools deploy --only "hosting:${SITE_NAME}" --project "$PROJECT_ID" --non-interactive

echo ""
echo "==================================================================="
echo "  ✅ CUSTOM HTTPS URL ACTIVE!"
echo "  URL: https://${SITE_NAME}.web.app/"
echo "==================================================================="
