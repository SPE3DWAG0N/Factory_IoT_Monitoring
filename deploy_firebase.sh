#!/bin/bash
set -e

PROJECT_ID="${1:-project-be0d8aa3-b99b-4b14-953}"
SITE_NAME="${2:-factory-iot-monitoring-2026}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==================================================================="
echo "  Deploying SCADA Dashboard to Custom Firebase Site"
echo "  Target URL: https://${SITE_NAME}.web.app"
echo "  Project:    $PROJECT_ID"
echo "==================================================================="

# 1. Enable Firebase APIs
echo "[1/4] Enabling Firebase APIs..."
gcloud services enable firebase.googleapis.com firebasehosting.googleapis.com --project="$PROJECT_ID" --quiet

# 2. Add Firebase to GCP project if not already added
echo "[2/4] Linking Firebase to Google Cloud Project..."
npx -y firebase-tools projects:addfirebase "$PROJECT_ID" 2>/dev/null || true

# 3. Create custom site if not created yet
echo "[3/4] Creating site $SITE_NAME..."
npx -y firebase-tools hosting:sites:create "$SITE_NAME" --project "$PROJECT_ID" 2>/dev/null || true

# 4. Deploy directly to the custom site
echo "[4/4] Deploying files to https://${SITE_NAME}.web.app..."
cd "$SCRIPT_DIR"
npx -y firebase-tools deploy --only "hosting:${SITE_NAME}" --project "$PROJECT_ID"

echo ""
echo "==================================================================="
echo "  ✅ CUSTOM HTTPS URL ACTIVE!"
echo "  URL: https://${SITE_NAME}.web.app/"
echo "==================================================================="
