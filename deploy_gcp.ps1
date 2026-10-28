<#
.SYNOPSIS
  AETHER-PLANT SCADA — Google Cloud One-Click Deploy Script (PowerShell)
.DESCRIPTION
  Automates the provisioning of GCP resources:
    - Cloud Pub/Sub (topics + subscriptions)
    - Cloud Storage (encrypted report bucket)
    - Google Secret Manager
    - Cloud Functions Gen 2 (Python 3.12)
    - Cloud Firestore (with TTL policy)
    - Compute Engine e2-micro instance
.PARAMETER ProjectId
  The GCP Project ID to deploy into.
.PARAMETER AlertEmail
  Email address to receive critical limit breach alerts.
.PARAMETER Region
  GCP Region (default: asia-south1).
.PARAMETER Zone
  GCP Compute Zone (default: asia-south1-a).
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$ProjectId,

  [Parameter(Position = 1)]
  [string]$AlertEmail = "engineer@plant-iot.internal",

  [string]$Region = "asia-south1",
  [string]$Zone = "asia-south1-a",
  [string]$ServicePassword = "plant-admin-2026",
  [string]$SepoliaRpc = "https://eth-sepolia.g.alchemy.com/v2/demo-key",
  [string]$ContractAddress = "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host "  AETHER-PLANT SCADA — Google Cloud Deployment (PowerShell)" -ForegroundColor Cyan
Write-Host "  Project: $ProjectId | Region: $Region" -ForegroundColor Cyan
Write-Host "=============================================================" -ForegroundColor Cyan

# Check gcloud CLI
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
  Write-Error "gcloud CLI not found in PATH. Install the Google Cloud SDK: https://cloud.google.com/sdk/docs/install"
}

Write-Host "`nSetting gcloud active project..." -ForegroundColor Yellow
gcloud config set project $ProjectId

# ── [1] Enable APIs ───────────────────────────────────────────────────────────
Write-Host "`n=== [1/9] Enabling required GCP APIs ===" -ForegroundColor Yellow
gcloud services enable `
  pubsub.googleapis.com `
  firestore.googleapis.com `
  storage.googleapis.com `
  cloudfunctions.googleapis.com `
  secretmanager.googleapis.com `
  compute.googleapis.com `
  iam.googleapis.com `
  cloudbuild.googleapis.com `
  artifactregistry.googleapis.com `
  eventarc.googleapis.com `
  run.googleapis.com `
  --quiet
Write-Host "  ✓ APIs enabled" -ForegroundColor Green

# ── [2] IAM Service Accounts ─────────────────────────────────────────────────
Write-Host "`n=== [2/9] Creating IAM Service Accounts ===" -ForegroundColor Yellow

# Functions SA
gcloud iam service-accounts create plant-functions-sa `
  --display-name="Aether Plant Cloud Functions SA" `
  --quiet 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "  [*] plant-functions-sa already exists" }

$FunctionsSa = "plant-functions-sa@${ProjectId}.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding $ProjectId `
  --member="serviceAccount:$FunctionsSa" `
  --role="roles/datastore.user" --quiet

gcloud projects add-iam-policy-binding $ProjectId `
  --member="serviceAccount:$FunctionsSa" `
  --role="roles/pubsub.publisher" --quiet

gcloud projects add-iam-policy-binding $ProjectId `
  --member="serviceAccount:$FunctionsSa" `
  --role="roles/secretmanager.secretAccessor" --quiet

# Compute SA
gcloud iam service-accounts create plant-compute-sa `
  --display-name="Aether Plant Compute Engine SA" `
  --quiet 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "  [*] plant-compute-sa already exists" }

$ComputeSa = "plant-compute-sa@${ProjectId}.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding $ProjectId `
  --member="serviceAccount:$ComputeSa" `
  --role="roles/datastore.user" --quiet

gcloud projects add-iam-policy-binding $ProjectId `
  --member="serviceAccount:$ComputeSa" `
  --role="roles/storage.objectAdmin" --quiet

gcloud projects add-iam-policy-binding $ProjectId `
  --member="serviceAccount:$ComputeSa" `
  --role="roles/secretmanager.secretAccessor" --quiet

Write-Host "  ✓ Service accounts and IAM bindings applied" -ForegroundColor Green

# ── [3] Cloud Pub/Sub ─────────────────────────────────────────────────────────
Write-Host "`n=== [3/9] Creating Pub/Sub topics and subscriptions ===" -ForegroundColor Yellow
gcloud pubsub topics create plant-telemetry --labels=project=plant-monitoring --quiet 2>$null
gcloud pubsub topics create plant-fault-alerts --labels=project=plant-monitoring --quiet 2>$null

gcloud pubsub subscriptions create plant-telemetry-store-readings `
  --topic=plant-telemetry `
  --ack-deadline=30 `
  --message-retention-duration=7d `
  --quiet 2>$null

gcloud pubsub subscriptions create plant-telemetry-fault-check `
  --topic=plant-telemetry `
  --ack-deadline=30 `
  --message-retention-duration=7d `
  --quiet 2>$null

Write-Host "  ✓ Pub/Sub infrastructure created" -ForegroundColor Green

# ── [4] Cloud Storage ─────────────────────────────────────────────────────────
Write-Host "`n=== [4/9] Creating Cloud Storage bucket ===" -ForegroundColor Yellow
$BucketName = "plant-reports-${ProjectId}"
gcloud storage buckets create "gs://${BucketName}" `
  --location=$Region `
  --uniform-bucket-level-access `
  --quiet 2>$null

gcloud storage buckets update "gs://${BucketName}" --public-access-prevention 2>$null

gcloud storage buckets add-iam-policy-binding "gs://${BucketName}" `
  --member="serviceAccount:$ComputeSa" `
  --role="roles/storage.objectAdmin" --quiet

Write-Host "  ✓ GCS bucket gs://$BucketName ready" -ForegroundColor Green

# ── [5] Secret Manager ────────────────────────────────────────────────────────
Write-Host "`n=== [5/9] Storing secrets in Secret Manager ===" -ForegroundColor Yellow

function Upsert-GcpSecret([string]$Name, [string]$Value) {
  gcloud secrets describe $Name --quiet 2>$null
  if ($LASTEXITCODE -eq 0) {
    $Value | gcloud secrets versions add $Name --data-file=- --quiet
  } else {
    $Value | gcloud secrets create $Name --data-file=- --replication-policy=user-managed --locations=$Region --quiet
  }
}

Upsert-GcpSecret "plant-service-password" $ServicePassword
Upsert-GcpSecret "plant-sepolia-rpc-url" $SepoliaRpc
Upsert-GcpSecret "plant-contract-address" $ContractAddress
Upsert-GcpSecret "plant-alert-email" $AlertEmail

Write-Host "  ✓ Secrets stored in Secret Manager" -ForegroundColor Green

# ── [6] Cloud Functions ───────────────────────────────────────────────────────
Write-Host "`n=== [6/9] Deploying Cloud Functions ===" -ForegroundColor Yellow
$FunctionsDir = Join-Path $ScriptDir "functions"

# Fault Handler
gcloud functions deploy plant-fault-handler `
  --gen2 `
  --runtime=python312 `
  --region=$Region `
  --source="$FunctionsDir" `
  --entry-point=fault_handler `
  --trigger-topic=plant-telemetry `
  --service-account="$FunctionsSa" `
  --memory=256MB `
  --timeout=60s `
  --set-env-vars="FAULTS_COLLECTION=plant-faults,READINGS_COLLECTION=plant-readings,ALERT_EMAIL_TO=${AlertEmail}" `
  --quiet

Write-Host "  ✓ plant-fault-handler deployed" -ForegroundColor Green

# Store Readings
gcloud functions deploy plant-store-readings `
  --gen2 `
  --runtime=python312 `
  --region=$Region `
  --source="$FunctionsDir" `
  --entry-point=store_readings `
  --trigger-topic=plant-telemetry `
  --service-account="$FunctionsSa" `
  --memory=256MB `
  --timeout=30s `
  --set-env-vars="READINGS_COLLECTION=plant-readings" `
  --quiet

Write-Host "  ✓ plant-store-readings deployed" -ForegroundColor Green

# ── [7] Cloud Firestore ───────────────────────────────────────────────────────
Write-Host "`n=== [7/9] Initialising Cloud Firestore ===" -ForegroundColor Yellow
gcloud firestore databases create --location=$Region --quiet 2>$null
gcloud firestore fields ttls update expire_at --collection-group=plant-readings --enable-ttl --quiet 2>$null
Write-Host "  ✓ Cloud Firestore database and TTL policy ready" -ForegroundColor Green

# ── [8] Compute Engine ────────────────────────────────────────────────────────
Write-Host "`n=== [8/9] Creating Compute Engine VM ===" -ForegroundColor Yellow

gcloud compute firewall-rules create plant-allow-web `
  --allow=tcp:80,tcp:22,tcp:5173 `
  --target-tags=plant-scada-server `
  --description="Aether Plant SCADA firewall" `
  --quiet 2>$null

$VmCheck = gcloud compute instances describe plant-scada-server --zone=$Zone --quiet 2>$null
if ($LASTEXITCODE -ne 0) {
  $StartupScriptPath = Join-Path $ScriptDir "gcp\vm-startup.sh"
  gcloud compute instances create plant-scada-server `
    --zone=$Zone `
    --machine-type=e2-micro `
    --image-family=ubuntu-2404-lts-amd64 `
    --image-project=ubuntu-os-cloud `
    --boot-disk-size=10GB `
    --boot-disk-type=pd-standard `
    --service-account="$ComputeSa" `
    --scopes=cloud-platform `
    --tags=plant-scada-server `
    --metadata-from-file "startup-script=$StartupScriptPath" `
    --quiet
  Write-Host "  ✓ VM plant-scada-server created" -ForegroundColor Green
} else {
  Write-Host "  [*] VM plant-scada-server already exists"
}

# ── [9] Summary ───────────────────────────────────────────────────────────────
Write-Host "`n=== [9/9] Deployment Summary ===" -ForegroundColor Yellow
$VmIp = gcloud compute instances describe plant-scada-server `
  --zone=$Zone `
  --format="get(networkInterfaces[0].accessConfigs[0].natIP)" 2>$null

Write-Host ""
Write-Host "=============================================================" -ForegroundColor Green
Write-Host "  ✅ AETHER-PLANT GCP DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "=============================================================" -ForegroundColor Green
Write-Host "  Project ID:     $ProjectId"
Write-Host "  Pub/Sub Topic:  projects/$ProjectId/topics/plant-telemetry"
Write-Host "  GCS Bucket:     gs://plant-reports-$ProjectId"
Write-Host "  VM External IP: $VmIp"
Write-Host "  Dashboard URL:  http://$VmIp/"
Write-Host ""
Write-Host "  Next Step: Deploy the React dashboard to the VM:" -ForegroundColor Cyan
Write-Host "    .\deploy_gcp_dashboard.ps1" -ForegroundColor White
Write-Host "=============================================================" -ForegroundColor Green

