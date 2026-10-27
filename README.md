# Cloud IoT Monitoring with Blockchain-Verified Service Reports

**Architecture Platform:** Google Cloud Platform `asia-south1` (Mumbai)  
**Blockchain Layer:** Ethereum Sepolia Testnet (Chain ID `11155111`)  
**Frontend Interface:** Industrial Cyber-SCADA Digital Twin & Verification Station  

> [!IMPORTANT]
> **Active Branch**: `gcp` (Google Cloud Platform deployment)  
> To switch to the AWS version of this project, run:
> ```bash
> git checkout aws
> ```

> **Migration Note:** This project was originally built on AWS (ap-south-1). All AWS services have been replaced with 1:1 Google Cloud equivalents in the same Mumbai region. The blockchain layer, SCADA dashboard, sensor topology, and fault logic are fully preserved.

---

## AWS → GCP Service Mapping

| AWS Service | Google Cloud Equivalent | Notes |
|---|---|---|
| AWS IoT Core (MQTT Broker) | **Cloud Pub/Sub** | `plant-telemetry` topic |
| IoT Core Rules Engine (Rule 1) | **Cloud Functions** `plant-store-readings` | Triggered by `plant-telemetry-store-readings` subscription |
| IoT Core Rules Engine (Rule 2) | **Cloud Functions** `plant-fault-handler` | Triggered by `plant-telemetry-fault-check` subscription |
| AWS Lambda | **Cloud Functions Gen 2** (Python 3.12) | Firestore transactional write |
| Amazon DynamoDB | **Cloud Firestore** (Native mode) | 3 collections: readings, faults, reports |
| Amazon SNS | **SMTP Email** via Cloud Functions | Credentials in Secret Manager |
| Amazon S3 | **Cloud Storage** (GCS) | Uniform Bucket-Level Access (= Block Public) |
| AWS SSM Parameter Store | **Secret Manager** | plant-service-password, plant-sepolia-rpc-url, plant-contract-address |
| AWS EC2 t3.micro | **Compute Engine e2-micro** | Ubuntu 24.04 LTS, asia-south1-a |
| AWS CloudFormation | **gcloud CLI** (`deploy_gcp.sh`) | One-click deploy script |
| AWS IAM Roles | **GCP Service Accounts** | plant-functions-sa, plant-compute-sa |

---

## 1. Project Overview

This project provides an end-to-end industrial monitoring solution for critical rotating machinery. Telemetry from 8 virtual IoT devices is published to **Cloud Pub/Sub**, fanned out to two **Cloud Functions** (store-all-readings + threshold-check), stored in **Cloud Firestore**, and alerts sent via SMTP email. Certified maintenance reports are stored in **Cloud Storage** with their SHA-256 digests anchored on the **Ethereum Sepolia** public testnet.

---

## 2. Machine & Device Topology

| Machine | Device ID | Monitored Metric | Nominal Range | Alert Limit | Pub/Sub Topic |
|---|---|---|---|---|---|
| **Machine A: Motor-Pump Set** | `A1-MOTOR-TEMP` | Motor Winding Temp | 55–75 °C | **> 90.0 °C** | `plant-telemetry` |
| | `A2-MOTOR-CURR` | Motor Supply Current | 7–10 A | **> 12.0 A** | `plant-telemetry` |
| | `A3-MOTOR-VIB` | Drive-End Bearing Vib | 2–4.5 mm/s | **> 7.0 mm/s** | `plant-telemetry` |
| | `A4-PUMP-VIB` | Pump Bearing Vib | 2–4.5 mm/s | **> 7.0 mm/s** | `plant-telemetry` |
| **Machine B: Conveyor Drive** | `B1-MOTOR-TEMP` | Conveyor Motor Temp | 55–75 °C | **> 90.0 °C** | `plant-telemetry` |
| | `B2-MOTOR-CURR` | Conveyor Supply Current | 7–10 A | **> 12.0 A** | `plant-telemetry` |
| | `B3-GBOX-VIB` | Gearbox Housing Vib | 2–4.5 mm/s | **> 7.0 mm/s** | `plant-telemetry` |
| | `B4-GBOX-TEMP` | Gearbox Oil Sump Temp | 55–75 °C | **> 90.0 °C** | `plant-telemetry` |

---

## 3. Repository Structure

```
├── gcp/
│   └── plant-deployment.yaml         # Google Cloud Deployment Manager config
├── functions/
│   ├── fault_handler.py              # Cloud Function: fault detection + Firestore + email alert
│   ├── store_readings.py             # Cloud Function: store all telemetry to Firestore
│   └── requirements.txt             # Python deps for Cloud Functions
├── simulator/
│   ├── device_simulator_gcp.py       # GCP Pub/Sub device simulator (replaces awsiotsdk)
│   └── device_simulator.py          # Original AWS simulator (reference only)
├── contracts/
│   └── ServiceReportRegistry.sol    # Solidity 0.8.x contract (unchanged)
├── lambda/
│   └── fault_handler.py             # Original AWS Lambda (reference only)
├── aws/
│   └── plant-cloudformation.yaml   # Original AWS template (reference only)
├── dashboard/                       # Modern React + Vite Cyber-SCADA Dashboard
│   └── src/
│       ├── components/              # Digital Twin, Tiles, Service Desk, Verifier, CloudPipeline (GCP)
│       ├── services/                # TelemetryEngine (GCP Pub/Sub simulation)
│       └── constants/               # plantConfig.js (GCP region, Firestore, Pub/Sub)
├── deploy_gcp.sh                    # ★ One-click GCP full stack deploy (gcloud CLI)
├── deploy_gcp_dashboard.sh          # Dashboard SCP deploy to Compute Engine VM
└── deploy_dashboard.sh             # Original AWS dashboard deploy (reference only)
```

---

## 4. Quick Deployment — Google Cloud

### Prerequisites
1. [Install Google Cloud CLI](https://cloud.google.com/sdk/docs/install)
2. Authenticate: `gcloud auth login`
3. Create a project: `gcloud projects create <PROJECT_ID>`
4. Enable billing on the project in the Cloud Console

### One-Click Deploy
```bash
# Deploy all GCP infrastructure (Pub/Sub, Firestore, Cloud Functions, GCS, VM)
bash deploy_gcp.sh <YOUR_GCP_PROJECT_ID> your-email@example.com
```

This single script:
1. Enables all required APIs
2. Creates IAM service accounts with least-privilege bindings
3. Creates Cloud Pub/Sub topics + subscriptions
4. Creates Cloud Storage bucket
5. Stores secrets in Secret Manager
6. Deploys both Cloud Functions (Python 3.12, Gen 2)
7. Initialises Firestore with TTL policy
8. Creates Compute Engine e2-micro VM (Ubuntu 24.04 LTS)
9. Outputs dashboard URL

### Deploy Dashboard
```bash
# After the VM is running, push the React build
bash deploy_gcp_dashboard.sh <VM_EXTERNAL_IP> [~/.ssh/google_compute_engine]
```

---

## 5. Run the GCP Device Simulator

```bash
# Install dependencies
pip install google-cloud-pubsub

# Set credentials
export GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json
export GCP_PROJECT_ID=your-gcp-project-id

# Run simulator
python simulator/device_simulator_gcp.py
```

Console commands:
- `inject A3-MOTOR-VIB` — spike vibration past threshold (triggers Cloud Function fault handler)
- `clear A3-MOTOR-VIB` — restore nominal baseline
- `status` — list active injections
- `quit` — stop simulation

---

## 6. Cloud Architecture Data Flow

```
[8 IoT Device Simulators]
        │ publish JSON via google-cloud-pubsub SDK
        ▼
[Cloud Pub/Sub: plant-telemetry topic]
        │
        ├─── Subscription: plant-telemetry-store-readings
        │           │
        │           ▼
        │    [Cloud Function: plant-store-readings]
        │           │ write payload + expire_at TTL
        │           ▼
        │    [Firestore: plant-readings collection]
        │
        └─── Subscription: plant-telemetry-fault-check
                    │
                    ▼
             [Cloud Function: plant-fault-handler]
                    │ threshold check (temp>90 OR vib>7 OR curr>12)
                    │ @transactional: get ACTIVE_MARKER → set fault + marker
                    │
                    ├──► [Firestore: plant-faults collection]
                    │
                    └──► [SMTP Email Alert] → engineer@plant-iot.internal

[SCADA Dashboard (Compute Engine e2-micro)]
        │ field engineer uploads PDF report
        ├──► [Cloud Storage: plant-reports-<PROJECT_ID>]
        └──► [Ethereum Sepolia: ServiceReportRegistry.storeHash()]
                    │
                    └──► Permanent on-chain cryptographic proof
```

---

## 7. GCP Free Tier Compatibility

| Service | Usage | Free Tier Limit |
|---|---|---|
| Cloud Pub/Sub | ~8 msgs/10s = ~2.4K msg/hr | 10 GiB/month free |
| Cloud Firestore | 3 collections, ~30 reads/min | 50K reads + 20K writes/day free |
| Cloud Functions | Event-driven, <60s each | 2M invocations/month free |
| Cloud Storage | PDF reports (< 1 GB) | 5 GB/month free |
| Compute Engine e2-micro | 1 VM | 1 e2-micro free per month (us-central1 / us-east1 / us-west1)† |
| Secret Manager | 4 secrets | 6 secrets free + 10K access/month |

> † **Note:** Compute Engine free tier only applies in `us-central1`, `us-east1`, or `us-west1`. For Mumbai (`asia-south1`) you will incur small VM charges (~$6/month). To stay free-tier, change `REGION` and `ZONE` in `deploy_gcp.sh` to `us-central1` / `us-central1-a`.

---

## 8. UI/UX Features (Unchanged)

1. **Interactive Machine Digital Twin** — animated SVG schematics of Machine A (Motor-Pump) & Machine B (Conveyor)
2. **Real-time Telemetry Tiles** — 8 live sensor tiles with sparklines and threshold bands
3. **Service Desk** — password protected, generates ISO 55001 PDF, computes SHA-256, broadcasts `storeHash` to Sepolia
4. **Public Verification Portal** — instant cryptographic match + 1-byte tamper demonstration
5. **GCP Architecture Map** — interactive 4-layer pipeline showing GCP Pub/Sub → Cloud Functions → Firestore → GCS → Sepolia
