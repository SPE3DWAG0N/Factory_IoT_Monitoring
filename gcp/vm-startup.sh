#!/bin/bash
# =============================================================================
#  AETHER-PLANT SCADA — GCP Compute Engine Startup Script
#  Runs automatically on first boot of the e2-micro VM (asia-south1-a)
#  GCP equivalent of the EC2 UserData script in plant-cloudformation.yaml
# =============================================================================
set -ex
exec > >(tee /var/log/aether-startup.log | logger -t aether-plant) 2>&1

# ── 1. Swap (prevents OOM on e2-micro during node install) ─────────────────
fallocate -l 1G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
echo "  [✓] Swap enabled"

# ── 2. System packages ──────────────────────────────────────────────────────
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git nginx

# Node.js 22 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# Pre-install serve globally so systemd unit runs without npx/network on start
npm install -g serve --loglevel=error
echo "  [✓] Node $(node -v) / npm $(npm -v) / serve installed"

# ── 3. App directory & ownership ────────────────────────────────────────────
mkdir -p /opt/aether-plant/dist
chown -R ubuntu:ubuntu /opt/aether-plant

# ── 4. Placeholder page (auto-refreshes every 15s until real deploy) ────────
cat << 'HTMLEOF' > /opt/aether-plant/dist/index.html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="15">
  <title>AETHER-PLANT | Initializing on GCP...</title>
  <style>
    *{margin:0;box-sizing:border-box}
    body{background:#070a13;color:#f3f4f6;font-family:'Courier New',monospace;
         display:flex;align-items:center;justify-content:center;height:100vh}
    .card{background:rgba(13,20,36,.92);border:1px solid rgba(56,189,248,.35);
          border-radius:14px;padding:44px 52px;text-align:center;max-width:600px;
          box-shadow:0 0 40px rgba(6,182,212,.2)}
    h1{color:#22d3ee;font-size:1.5rem;margin-bottom:6px;letter-spacing:.05em}
    .sub{color:#9ca3af;font-size:.9rem;margin-bottom:24px;line-height:1.6}
    .badge{background:rgba(16,185,129,.12);color:#34d399;
           border:1px solid rgba(16,185,129,.3);border-radius:20px;
           padding:4px 14px;display:inline-block;font-size:.78rem;font-weight:700;
           margin-bottom:20px;animation:pulse 2s infinite}
    .info{background:#000;padding:10px 16px;border-radius:8px;
          border:1px solid rgba(255,255,255,.08);color:#c084fc;font-size:.8rem}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">● GCP COMPUTE ENGINE OPERATIONAL</div>
    <h1>AETHER-PLANT SCADA</h1>
    <p class="sub">Google Cloud Infrastructure active.<br>
    Firestore, Cloud Functions Fault Handler, Pub/Sub Alerts &amp; GCS Reports are provisioned.<br>
    <strong style="color:#fbbf24">Run deploy_gcp_dashboard.sh to upload the React dashboard.</strong></p>
    <div class="info">GCP Deployment Manager: CREATE_COMPLETE &nbsp;|&nbsp; Page refreshes every 15s</div>
  </div>
</body>
</html>
HTMLEOF

# ── 5. systemd service — serve the React dashboard on port 80 ─────────────
cat << 'SVCEOF' > /etc/systemd/system/aether-scada.service
[Unit]
Description=Aether Plant SCADA Industrial Monitoring Service (GCP)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/aether-plant
ExecStart=/usr/local/bin/serve -s /opt/aether-plant/dist -l 80
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCEOF

# ── 6. Enable & start the service ───────────────────────────────────────────
systemctl daemon-reload
systemctl enable aether-scada
systemctl start aether-scada

echo '=== AETHER-PLANT GCP STARTUP COMPLETE ==='
