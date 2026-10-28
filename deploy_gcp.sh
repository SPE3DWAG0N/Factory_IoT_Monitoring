#!/bin/bash
# =============================================================================
# AETHER-PLANT SCADA — Google Cloud One-Click Deploy Script
# GCP equivalent of deploy_cloud.sh (was AWS CloudFormation)
#
# Usage:
#   1. Install Google Cloud CLI: https://cloud.google.com/sdk/docs/install
#      (Or run in Google Cloud Shell directly in browser)
#   2. Run: bash deploy_gcp.sh <YOUR_GCP_PROJECT_ID> [ALERT_EMAIL]
#
# What this script does (in order):
#   [1] Enables all required GCP APIs (Pub/Sub, Firestore, Functions, Cloud Build, Eventarc, etc.)
#   [2] Creates IAM Service Accounts with least-privilege roles
#   [3] Creates Cloud Pub/Sub topics + subscriptions
#   [4] Creates Cloud Storage bucket (replaces S3)
#   [5] Creates Google Secret Manager secrets (replaces SSM Parameter Store)
#   [6] Deploys Cloud Functions: fault-handler + store-readings (replaces Lambda)
#   [7] Sets up Cloud Firestore database (replaces DynamoDB) with TTL policy
#   [8] Creates Compute Engine e2-micro instance (replaces EC2 t3.micro)
#   [9] Outputs all resource names and dashboard URL
# =============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Arguments ─────────────────────────────────────────────────────────────────
PROJECT_ID="${1:-}"
ALERT_EMAIL="${2:-engineer@plant-iot.internal}"
REGION="asia-south1"          # Mumbai — same as AWS ap-south-1
ZONE="asia-south1-a"
SERVICE_PASSWORD="plant-admin-2026"
SEPOLIA_RPC="https://eth-sepolia.g.alchemy.com/v2/demo-key"
CONTRACT_ADDRESS="0x8A791620dd6260079BF849Dc5567aDC3F2FdC318"

if [ -z "$PROJECT_ID" ]; then
  echo "Usage: $0 <GCP_PROJECT_ID> [ALERT_EMAIL]"
  echo "Example: $0 my-plant-project-123 engineer@mycompany.com"
  exit 1
fi

echo ""
echo "============================================================="
echo "  AETHER-PLANT SCADA — Google Cloud Deployment"
echo "  Project: $PROJECT_ID | Region: $REGION"
echo "============================================================="

gcloud config set project "$PROJECT_ID"

# ── [1] Enable APIs ───────────────────────────────────────────────────────────
echo ""
echo "=== [1/9] Enabling required GCP APIs ==="
gcloud services enable \
  pubsub.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com \
  cloudfunctions.googleapis.com \
  secretmanager.googleapis.com \
  compute.googleapis.com \
  iam.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  eventarc.googleapis.com \
  run.googleapis.com \
  --quiet
echo "  ✓ APIs enabled"

# ── [2] IAM Service Accounts ─────────────────────────────────────────────────
echo ""
echo "=== [2/9] Creating IAM Service Accounts & Build Permissions ==="

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
echo "  [*] Project Number: $PROJECT_NUMBER"

# Ensure service identities exist for Pub/Sub & Eventarc
gcloud beta services identity create --service=pubsub.googleapis.com --project="$PROJECT_ID" --quiet 2>/dev/null || true
gcloud beta services identity create --service=eventarc.googleapis.com --project="$PROJECT_ID" --quiet 2>/dev/null || true

# Fix Cloud Build permissions (required for Cloud Functions Gen 2 builds in modern GCP)
COMPUTE_DEFAULT_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
CLOUDBUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

for SA in "$COMPUTE_DEFAULT_SA" "$CLOUDBUILD_SA"; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA" \
    --role="roles/logging.logWriter" --quiet 2>/dev/null || true
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA" \
    --role="roles/artifactregistry.writer" --quiet 2>/dev/null || true
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA" \
    --role="roles/storage.objectViewer" --quiet 2>/dev/null || true
done

# Grant Pub/Sub Service Agent token creator (required for Gen 2 Eventarc Pub/Sub triggers)
PUBSUB_SA="service-${PROJECT_NUMBER}@gcp-sa-pubsub.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$PUBSUB_SA" \
  --role="roles/iam.serviceAccountTokenCreator" --quiet 2>/dev/null || true

# Functions SA
gcloud iam service-accounts create plant-functions-sa \
  --display-name="Aether Plant Cloud Functions SA" \
  --quiet 2>/dev/null || echo "  [*] plant-functions-sa already exists"

FUNCTIONS_SA="plant-functions-sa@${PROJECT_ID}.iam.gserviceaccount.com"

# Grant Firestore write + Pub/Sub publish + Secret Manager access
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$FUNCTIONS_SA" \
  --role="roles/datastore.user" --quiet

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$FUNCTIONS_SA" \
  --role="roles/pubsub.publisher" --quiet

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$FUNCTIONS_SA" \
  --role="roles/secretmanager.secretAccessor" --quiet

# Compute SA
gcloud iam service-accounts create plant-compute-sa \
  --display-name="Aether Plant Compute Engine SA" \
  --quiet 2>/dev/null || echo "  [*] plant-compute-sa already exists"

COMPUTE_SA="plant-compute-sa@${PROJECT_ID}.iam.gserviceaccount.com"

# Grant Firestore read/write + GCS + Secret Manager
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$COMPUTE_SA" \
  --role="roles/datastore.user" --quiet

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$COMPUTE_SA" \
  --role="roles/storage.objectAdmin" --quiet

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$COMPUTE_SA" \
  --role="roles/secretmanager.secretAccessor" --quiet

echo "  ✓ Service accounts created and IAM bindings applied"

# ── [3] Cloud Pub/Sub Topics + Subscriptions ──────────────────────────────────
echo ""
echo "=== [3/9] Creating Pub/Sub topics and subscriptions ==="

gcloud pubsub topics create plant-telemetry \
  --labels=project=plant-monitoring --quiet 2>/dev/null || echo "  [*] plant-telemetry topic exists"

gcloud pubsub topics create plant-fault-alerts \
  --labels=project=plant-monitoring --quiet 2>/dev/null || echo "  [*] plant-fault-alerts topic exists"

# Explicit subscriptions (useful for monitoring, auditing, or custom subscribers)
gcloud pubsub subscriptions create plant-telemetry-store-readings \
  --topic=plant-telemetry \
  --ack-deadline=30 \
  --message-retention-duration=7d \
  --quiet 2>/dev/null || echo "  [*] store-readings subscription exists"

gcloud pubsub subscriptions create plant-telemetry-fault-check \
  --topic=plant-telemetry \
  --ack-deadline=30 \
  --message-retention-duration=7d \
  --quiet 2>/dev/null || echo "  [*] fault-check subscription exists"

echo "  ✓ Pub/Sub infrastructure created"

# ── [4] Cloud Storage Bucket ──────────────────────────────────────────────────
echo ""
echo "=== [4/9] Creating Cloud Storage bucket (replaces Amazon S3) ==="

BUCKET_NAME="plant-reports-${PROJECT_ID}"
gcloud storage buckets create "gs://${BUCKET_NAME}" \
  --location="$REGION" \
  --uniform-bucket-level-access \
  --quiet 2>/dev/null || echo "  [*] Bucket gs://$BUCKET_NAME already exists"

# Enforce uniform bucket-level access & public access prevention
gcloud storage buckets update "gs://${BUCKET_NAME}" \
  --public-access-prevention 2>/dev/null || true

# Grant compute SA read/write on bucket
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET_NAME}" \
  --member="serviceAccount:$COMPUTE_SA" \
  --role="roles/storage.objectAdmin" --quiet

echo "  ✓ GCS bucket gs://$BUCKET_NAME created"

# ── [5] Secret Manager (replaces AWS SSM Parameter Store) ─────────────────────
echo ""
echo "=== [5/9] Storing secrets in Google Secret Manager ==="

_upsert_secret() {
  local name="$1"
  local value="$2"
  if gcloud secrets describe "$name" --quiet 2>/dev/null; then
    echo "$value" | gcloud secrets versions add "$name" --data-file=- --quiet
  else
    echo "$value" | gcloud secrets create "$name" \
      --data-file=- \
      --replication-policy=user-managed \
      --locations="$REGION" \
      --quiet
  fi
}

_upsert_secret "plant-service-password"   "$SERVICE_PASSWORD"
_upsert_secret "plant-sepolia-rpc-url"    "$SEPOLIA_RPC"
_upsert_secret "plant-contract-address"   "$CONTRACT_ADDRESS"
_upsert_secret "plant-alert-email"        "$ALERT_EMAIL"

echo "  ✓ Secrets stored in Secret Manager"

# ── [6] Cloud Functions (replaces AWS Lambda) ─────────────────────────────────
echo ""
echo "=== [6/9] Deploying Cloud Functions (replaces AWS Lambda) ==="

FUNCTIONS_DIR="$SCRIPT_DIR/functions"

# Deploy fault-handler (Rule 2 equivalent: threshold check + Firestore + email)
# Note: --trigger-topic is the plant-telemetry topic where IoT sensor data is published.
gcloud functions deploy plant-fault-handler \
  --gen2 \
  --runtime=python312 \
  --region="$REGION" \
  --source="$FUNCTIONS_DIR" \
  --entry-point=fault_handler \
  --trigger-topic=plant-telemetry \
  --service-account="$FUNCTIONS_SA" \
  --memory=256MB \
  --timeout=60s \
  --set-env-vars="FAULTS_COLLECTION=plant-faults,READINGS_COLLECTION=plant-readings,ALERT_EMAIL_TO=${ALERT_EMAIL}" \
  --quiet
echo "  ✓ plant-fault-handler deployed"

# Deploy store-readings (Rule 1 equivalent: store all telemetry to Firestore)
gcloud functions deploy plant-store-readings \
  --gen2 \
  --runtime=python312 \
  --region="$REGION" \
  --source="$FUNCTIONS_DIR" \
  --entry-point=store_readings \
  --trigger-topic=plant-telemetry \
  --service-account="$FUNCTIONS_SA" \
  --memory=256MB \
  --timeout=30s \
  --set-env-vars="READINGS_COLLECTION=plant-readings" \
  --quiet
echo "  ✓ plant-store-readings deployed"

# ── [7] Cloud Firestore (replaces Amazon DynamoDB) ────────────────────────────
echo ""
echo "=== [7/9] Initialising Cloud Firestore (replaces Amazon DynamoDB) ==="

# Create Firestore in Native mode (only one database per project on free tier)
gcloud firestore databases create \
  --location="$REGION" \
  --quiet 2>/dev/null || echo "  [*] Firestore database already exists"

# Apply TTL policy on plant-readings collection (equivalent to DynamoDB TTL expire_at)
gcloud firestore fields ttls update expire_at \
  --collection-group=plant-readings \
  --enable-ttl \
  --quiet 2>/dev/null || echo "  [*] TTL policy already applied"

echo "  ✓ Firestore (plant-readings, plant-faults, plant-reports collections) ready"

# ── [8] Compute Engine e2-micro (replaces AWS EC2 t3.micro) ─────────────────
echo ""
echo "=== [8/9] Creating Compute Engine e2-micro VM (replaces AWS EC2 t3.micro) ==="

# Firewall rules
gcloud compute firewall-rules create plant-allow-web \
  --allow=tcp:80,tcp:22,tcp:5173 \
  --target-tags=plant-scada-server \
  --description="Aether Plant SCADA firewall" \
  --quiet 2>/dev/null || echo "  [*] Firewall rule already exists"

# Create VM if it doesn't exist
if ! gcloud compute instances describe plant-scada-server \
     --zone="$ZONE" --quiet 2>/dev/null; then

  gcloud compute instances create plant-scada-server \
    --zone="$ZONE" \
    --machine-type=e2-micro \
    --image-family=ubuntu-2404-lts-amd64 \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=10GB \
    --boot-disk-type=pd-standard \
    --service-account="$COMPUTE_SA" \
    --scopes=cloud-platform \
    --tags=plant-scada-server \
    --metadata-from-file startup-script="$SCRIPT_DIR/gcp/vm-startup.sh" \
    --quiet
  echo "  ✓ VM plant-scada-server created"
else
  echo "  [*] VM plant-scada-server already exists"
fi

# ── [9] Output Summary ────────────────────────────────────────────────────────
echo ""
VM_IP=$(gcloud compute instances describe plant-scada-server \
  --zone="$ZONE" \
  --format="get(networkInterfaces[0].accessConfigs[0].natIP)" 2>/dev/null || echo "<pending>")

echo "============================================================="
echo "  ✅ AETHER-PLANT GCP DEPLOYMENT COMPLETE!"
echo ""
echo "  ┌─────────────────────────────────────────────────────┐"
echo "  │  GCP SERVICE MAPPING (AWS → GCP)                   │"
echo "  ├─────────────────────────────────────────────────────┤"
echo "  │  AWS IoT Core        → Cloud Pub/Sub               │"
echo "  │  AWS Lambda          → Cloud Functions (Gen 2)     │"
echo "  │  Amazon DynamoDB     → Cloud Firestore             │"
echo "  │  Amazon SNS          → SMTP Email via Cloud Fn     │"
echo "  │  Amazon S3           → Cloud Storage               │"
echo "  │  AWS SSM Param Store → Secret Manager              │"
echo "  │  AWS EC2 t3.micro    → Compute Engine e2-micro     │"
echo "  │  AWS CloudFormation  → gcloud CLI (this script)    │"
echo "  └─────────────────────────────────────────────────────┘"
echo ""
echo "  Pub/Sub Topic:   projects/$PROJECT_ID/topics/plant-telemetry"
echo "  GCS Bucket:      gs://plant-reports-${PROJECT_ID}"
echo "  VM IP:           $VM_IP"
echo "  Dashboard URL:   http://$VM_IP/"
echo ""
echo "  Next step: deploy the React dashboard:"
echo "    bash deploy_gcp_dashboard.sh $VM_IP"
echo "============================================================="
