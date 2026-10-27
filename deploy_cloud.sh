#!/bin/bash
# =============================================================================
# AETHER-PLANT SCADA — EC2 Bootstrap Script (run once on a fresh Ubuntu 24.04)
# Designed to be run via SSH after the EC2 instance is provisioned:
#   ssh -i key.pem ubuntu@<EC2_IP> 'bash -s' < deploy_cloud.sh
# =============================================================================
set -e

echo ""
echo "==================================================================="
echo "  AETHER-PLANT SCADA — EC2 Bootstrap"
echo "==================================================================="

echo "=== [1/5] Adding 1GB swap file (prevents OOM on t3.micro) ==="
if [ ! -f /swapfile ]; then
  sudo fallocate -l 1G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab > /dev/null
  echo "  ✓ Swap enabled"
else
  echo "  ✓ Swap already configured"
fi

echo "=== [2/5] Installing Node.js 22 LTS ==="
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -y -q
sudo apt-get install -y -q curl git

curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - > /dev/null 2>&1
sudo apt-get install -y -q nodejs
echo "  ✓ Node $(node -v) / npm $(npm -v)"

echo "=== [3/5] Pre-installing serve globally ==="
sudo npm install -g serve --loglevel=error
echo "  ✓ serve $(serve --version 2>/dev/null || echo 'installed')"

echo "=== [4/5] Setting up SCADA app directory ==="
sudo mkdir -p /opt/aether-plant/dist
sudo chown -R ubuntu:ubuntu /opt/aether-plant

# Placeholder index.html (port 80 will serve this until real deploy)
cat << 'HTMLEOF' > /opt/aether-plant/dist/index.html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="15">
  <title>AETHER-PLANT | Ready for Dashboard Deploy</title>
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
    <div class="badge">● EC2 BOOTSTRAP COMPLETE</div>
    <h1>AETHER-PLANT SCADA</h1>
    <p class="sub">Server is ready.<br>
    Run <strong style="color:#22d3ee">deploy_dashboard.sh</strong> from your local machine<br>
    to push the React dashboard to this server.</p>
    <div class="info">Auto-refreshes every 15 seconds | Port 80</div>
  </div>
</body>
</html>
HTMLEOF

echo "  ✓ Placeholder page created"

echo "=== [5/5] Creating & starting systemd service (port 80) ==="
sudo tee /etc/systemd/system/aether-scada.service > /dev/null << 'SVCEOF'
[Unit]
Description=Aether Plant SCADA Industrial Monitoring Service
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

sudo systemctl daemon-reload
sudo systemctl enable aether-scada
sudo systemctl restart aether-scada
sleep 2
sudo systemctl status aether-scada --no-pager

echo ""
echo "==================================================================="
PUBLIC_IP=$(curl -s --max-time 5 http://checkip.amazonaws.com || echo "<your-ec2-ip>")
echo "  ✅ EC2 BOOTSTRAP COMPLETE!"
echo ""
echo "  EC2 is now serving on port 80."
echo "  Visit: http://$PUBLIC_IP/"
echo ""
echo "  To deploy the full dashboard, run locally:"
echo "  bash deploy_dashboard.sh $PUBLIC_IP path/to/your-key.pem"
echo "==================================================================="
