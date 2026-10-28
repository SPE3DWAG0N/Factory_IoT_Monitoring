#!/bin/bash
set -e

PROJECT_ID="${1:-project-be0d8aa3-b99b-4b14-953}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==================================================================="
echo "  Deploying SCADA Dashboard to Google Cloud Edge (Firebase Hosting)"
echo "  Project: $PROJECT_ID"
echo "==================================================================="

# 1. Enable Firebase Hosting API in GCP
echo "[1/2] Enabling Firebase Hosting API in Google Cloud..."
gcloud services enable firebasehosting.googleapis.com --project="$PROJECT_ID" --quiet

# 2. Deploy
echo "[2/2] Deploying pre-built dashboard bundle to Google CDN..."
cd "$SCRIPT_DIR"
npx -y firebase-tools deploy --only hosting --project "$PROJECT_ID"

echo ""
echo "==================================================================="
echo "  ✅ GLOBAL HTTPS URL ACTIVE!"
echo "  URL: https://${PROJECT_ID}.web.app/"
echo "==================================================================="
