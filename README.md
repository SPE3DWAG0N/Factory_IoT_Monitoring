# Cloud IoT Monitoring with Blockchain-Verified Service Reports (AWS Version)

**Architecture Platform:** Amazon Web Services `ap-south-1` (Mumbai)  
**Blockchain Layer:** Ethereum Sepolia Testnet (Chain ID `11155111`)  
**Frontend Interface:** Industrial Cyber-SCADA Digital Twin & Verification Station  

> [!IMPORTANT]
> **Active Branch**: `aws` (Amazon Web Services deployment)  
> To switch to the Google Cloud Platform (GCP) version of this project, run:
> ```bash
> git checkout gcp
> ```

---

## 1. AWS Architecture Overview

This project provides an end-to-end industrial IoT monitoring and blockchain audit trail solution:
1. **AWS IoT Core**: Receives mTLS X.509 authenticated sensor telemetry from 8 physical/virtual industrial Things with MQTT QoS 1.
2. **Topic Rule 1 (`plant_rule1_readings`)**: Dynamically writes all sensor readings into Amazon DynamoDB `plant-readings` table with a 7-day automatic TTL expiration (`expire_at`).
3. **Topic Rule 2 (`plant_rule2_faults`)**: SQL threshold monitor (`WHERE temperature > 90 OR vibration > 7 OR current > 12`) that routes limit breaches to AWS Lambda.
4. **AWS Lambda (`plant-fault-handler`)**: Executes atomic DynamoDB conditional transaction (`attribute_not_exists`) on `ACTIVE_MARKER` to guarantee exactly 1 open fault per device and eliminates duplicate alerts.
5. **Amazon SNS (`plant-fault-alerts`)**: Immediately dispatches critical email alerts with machine and device context to on-call reliability engineers.
6. **Amazon S3 (`plant-reports-${AWS::AccountId}`)**: Private encrypted repository (SSE-AES256) storing tamper-proof maintenance service PDFs.
7. **Amazon EC2 (`t3.micro` Ubuntu 24.04 LTS)**: Hosts the SCADA dashboard under systemd on port 80.
8. **Ethereum Sepolia Blockchain**: Smart contract `ServiceReportRegistry.sol` anchors SHA-256 PDF hashes directly into public blocks for 0-gas public verification.

---

## 2. Machine & Sensor Topology

| Machine | Device ID | Monitored Metric | Nominal Range | Alert Limit | MQTT Topic |
|---|---|---|---|---|---|
| **Machine A: Motor-Pump Set** | `A1-MOTOR-TEMP` | Motor Winding Temp | 58–74 °C | **> 90.0 °C** | `plant/MACHINE-A/A1-MOTOR-TEMP/telemetry` |
| | `A2-MOTOR-CURR` | Motor Supply Current | 7.2–9.8 A | **> 12.0 A** | `plant/MACHINE-A/A2-MOTOR-CURR/telemetry` |
| | `A3-MOTOR-VIB` | Drive-End Bearing Vib | 2.1–4.2 mm/s | **> 7.0 mm/s** | `plant/MACHINE-A/A3-MOTOR-VIB/telemetry` |
| | `A4-PUMP-VIB` | Pump Bearing Vib | 2.2–4.4 mm/s | **> 7.0 mm/s** | `plant/MACHINE-A/A4-PUMP-VIB/telemetry` |
| **Machine B: Conveyor Drive** | `B1-MOTOR-TEMP` | Conveyor Motor Temp | 56–73 °C | **> 90.0 °C** | `plant/MACHINE-B/B1-MOTOR-TEMP/telemetry` |
| | `B2-MOTOR-CURR` | Conveyor Supply Current | 7.5–9.9 A | **> 12.0 A** | `plant/MACHINE-B/B2-MOTOR-CURR/telemetry` |
| | `B3-GBOX-VIB` | Gearbox Housing Vib | 2.3–4.5 mm/s | **> 7.0 mm/s** | `plant/MACHINE-B/B3-GBOX-VIB/telemetry` |
| | `B4-GBOX-TEMP` | Gearbox Oil Sump Temp | 59–75 °C | **> 90.0 °C** | `plant/MACHINE-B/B4-GBOX-TEMP/telemetry` |

---

## 3. Repository Structure

```
├── aws/
│   └── plant-cloudformation.yaml     # 1-Click CloudFormation Infrastructure Template
├── lambda/
│   └── fault_handler.py              # AWS Lambda fault handler function (Python 3.12)
├── simulator/
│   ├── provision_iot_things.py       # Provisions 8 IoT Things, X.509 certs, policies & ATS endpoint
│   └── device_simulator.py           # IoT telemetry generator with mTLS AWS IoT Core & mock stream
├── contracts/
│   └── ServiceReportRegistry.sol     # Solidity 0.8.x contract for Sepolia testnet
├── dashboard/                        # Cyber-SCADA React Dashboard (Vite + Lucide)
├── deploy_cloud.sh                   # EC2 bootstrap script (Node.js 22 LTS + systemd serve)
├── deploy_dashboard.sh               # Local build & rsync deploy script to EC2
└── docs/
    └── AWS_FREE_TIER_AND_CLOUDFORMATION_GUIDE.md  # Detailed step-by-step setup guide
```

---

## 4. Quickstart: 3-Step AWS Deployment

### Step 1: Deploy Cloud Infrastructure via CloudFormation
1. Open the [AWS CloudFormation Console](https://ap-south-1.console.aws.amazon.com/cloudformation) in **ap-south-1 (Mumbai)**.
2. Click **Create stack** -> **With new resources (standard)**.
3. Select **Upload a template file** and choose `aws/plant-cloudformation.yaml`.
4. Enter parameters:
   - **Stack name**: `aether-plant-stack`
   - **AlertEmail**: Your email address for critical machine fault notifications.
   - **ServicePassword**: Access password for field engineers (default: `plant-admin-2026`).
5. Acknowledge IAM resource creation and click **Submit**.
6. Check your email inbox and click **Confirm subscription** in the SNS notification email.

### Step 2: Provision IoT Things & Certificates
Run the automated provisioning script to register the 8 IoT Things in AWS IoT Core and download certificates:
```bash
# 1. Install boto3
pip install boto3

# 2. Run provisioning (generates certs/, keys, root CA, and endpoint.txt)
python simulator/provision_iot_things.py
```

### Step 3: Start the Device Simulator
Run the simulator to publish live telemetry:
```bash
# Install AWS IoT Device SDK v2 (optional, falls back to local simulation if absent)
pip install awsiotsdk

# Start simulator (automatically detects certs/ and connects via mTLS)
python simulator/device_simulator.py
```
**Interactive CLI Commands:**
- `inject A1-MOTOR-TEMP` — Spikes motor temperature past 90°C (triggers Rule 2 -> Lambda -> DynamoDB -> SNS Email).
- `clear A1-MOTOR-TEMP` — Restores nominal temperature baseline.
- `status` — Shows active anomaly injections and connection status.
- `quit` — Exits simulator.

### Step 4: Access the SCADA Dashboard
- **Locally:**
  ```bash
  npm run dev
  ```
  Open `http://localhost:5173/` in your browser.
- **On Cloud EC2:**
  Get the public IP from CloudFormation Outputs (`DashboardAccessUrl`) or deploy the latest build via:
  ```bash
  bash deploy_dashboard.sh <EC2_PUBLIC_IP> <path_to_ssh_key.pem>
  ```

---

## 5. Branch Management: Deploying on AWS vs GCP

This repository contains two independent, production-grade cloud configurations:

| Branch | Target Cloud | Services Used | Switch Command |
|---|---|---|---|
| **`aws`** | Amazon Web Services | IoT Core, DynamoDB, Lambda, SNS, S3, EC2 | `git checkout aws` |
| **`gcp`** | Google Cloud Platform | Pub/Sub, Firestore, Cloud Functions, GCS, Compute Engine | `git checkout gcp` |

To switch branches:
```bash
# Switch to AWS deployment:
git checkout aws

# Switch to Google Cloud deployment:
git checkout gcp
```
