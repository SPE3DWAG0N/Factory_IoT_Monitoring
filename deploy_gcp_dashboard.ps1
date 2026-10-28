<#
.SYNOPSIS
  AETHER-PLANT SCADA — Deploy Dashboard to GCP Compute Engine (PowerShell)
.DESCRIPTION
  Builds the React SCADA frontend and uploads it to the plant-scada-server VM.
.PARAMETER VmIp
  Optional external IP of the VM. If omitted, uses 'plant-scada-server' instance via gcloud.
.PARAMETER Zone
  Compute Engine Zone (default: asia-south1-a).
#>

[CmdletBinding()]
param(
  [string]$VmIp,
  [string]$Zone = "asia-south1-a",
  [string]$InstanceName = "plant-scada-server"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DashboardDir = Join-Path $ScriptDir "dashboard"
$RemoteDir = "/opt/aether-plant/dist"

Write-Host ""
Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host "  AETHER-PLANT SCADA — GCP Dashboard Deployment Pipeline (PowerShell)" -ForegroundColor Cyan
Write-Host "===================================================================" -ForegroundColor Cyan

# Step 1: Build React
Write-Host "`n[1/4] Building React production bundle locally..." -ForegroundColor Yellow
Push-Location $DashboardDir
try {
  if (Test-Path "package-lock.json") {
    npm ci --silent
  } else {
    npm install --silent
  }
  npm run build
} finally {
  Pop-Location
}
Write-Host "  ✓ Build complete." -ForegroundColor Green

# Step 2 & 3: Upload
if ($VmIp -and ($VmIp -match "^\d+\.\d+\.\d+\.\d+$")) {
  Write-Host "`n[2/4] Preparing remote directory via SSH ($VmIp)..." -ForegroundColor Yellow
  ssh -o StrictHostKeyChecking=no ubuntu@$VmIp "sudo mkdir -p $RemoteDir && sudo chown -R ubuntu:ubuntu /opt/aether-plant"

  Write-Host "`n[3/4] Uploading build files to VM via SCP..." -ForegroundColor Yellow
  scp -r -o StrictHostKeyChecking=no "$DashboardDir\dist\*" ubuntu@${VmIp}:${RemoteDir}/

  Write-Host "`n[4/4] Restarting aether-scada service..." -ForegroundColor Yellow
  ssh -o StrictHostKeyChecking=no ubuntu@$VmIp "sudo systemctl restart aether-scada && sudo systemctl status aether-scada --no-pager"

  Write-Host "`n===================================================================" -ForegroundColor Green
  Write-Host "  ✅ DASHBOARD DEPLOYED!" -ForegroundColor Green
  Write-Host "  Dashboard URL: http://$VmIp/" -ForegroundColor Cyan
  Write-Host "===================================================================" -ForegroundColor Green
} else {
  Write-Host "`n[2/4] Preparing remote VM via gcloud compute ssh ($InstanceName in $Zone)..." -ForegroundColor Yellow
  gcloud compute ssh $InstanceName --zone=$Zone --command="sudo mkdir -p $RemoteDir && sudo chown -R ubuntu:ubuntu /opt/aether-plant" --quiet

  Write-Host "`n[3/4] Uploading build files via gcloud compute scp..." -ForegroundColor Yellow
  gcloud compute scp --recurse "$DashboardDir\dist\*" "${InstanceName}:${RemoteDir}/" --zone=$Zone --quiet

  Write-Host "`n[4/4] Restarting aether-scada service..." -ForegroundColor Yellow
  gcloud compute ssh $InstanceName --zone=$Zone --command="sudo systemctl restart aether-scada && sudo systemctl status aether-scada --no-pager" --quiet

  $ExtIp = gcloud compute instances describe $InstanceName --zone=$Zone --format="get(networkInterfaces[0].accessConfigs[0].natIP)" 2>$null

  Write-Host "`n===================================================================" -ForegroundColor Green
  Write-Host "  ✅ DASHBOARD DEPLOYED!" -ForegroundColor Green
  Write-Host "  Dashboard URL: http://$ExtIp/" -ForegroundColor Cyan
  Write-Host "===================================================================" -ForegroundColor Green
}

