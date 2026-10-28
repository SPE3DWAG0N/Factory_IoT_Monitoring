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
echo "[1/2] Enabling Firebase APIs..."
gcloud services enable firebase.googleapis.com firebasehosting.googleapis.com --project="$PROJECT_ID" --quiet

# 2. Deploy directly to the custom site
echo "[2/2] Deploying files to https://${SITE_NAME}.web.app..."
cd "$SCRIPT_DIR"
npx -y firebase-tools deploy --only "hosting:${SITE_NAME}" --project "$PROJECT_ID" --non-interactive

echo ""
echo "==================================================================="
echo "  ✅ CUSTOM HTTPS URL ACTIVE!"
echo "  URL: https://${SITE_NAME}.web.app/"
echo "==================================================================="
