import React, { useState } from 'react';
import { 
  Network, 
  Cpu, 
  Radio, 
  Database, 
  Zap, 
  Mail, 
  HardDrive, 
  ShieldCheck, 
  Server
} from 'lucide-react';
import { PLANT_CONFIG } from '../constants/plantConfig';
import { sound } from '../utils/sound';

export default function CloudPipeline() {
  const [selectedNode, setSelectedNode] = useState('pubsub');

  const nodes = {
    devices: {
      title: 'Device Simulator (8 Virtual IoT Devices)',
      subtitle: 'Python 3.12 + Google Cloud Pub/Sub SDK (google-cloud-pubsub)',
      color: '#38bdf8',
      details: [
        '8 virtual industrial machines (4 on Machine A Motor-Pump, 4 on Machine B Conveyor).',
        'Authenticates with GCP via Application Default Credentials (ADC) — Service Account JSON key.',
        'Publishes structured JSON telemetry to Cloud Pub/Sub topic: projects/<PROJECT_ID>/topics/plant-telemetry.',
        'Message attributes carry machine_id, device_id, sensor_type for high-speed routing.',
        'Console inject and clear commands to simulate anomalous conditions on demand.',
        'Standardized telemetry schema with ISO timestamp and calibrated engineering units.'
      ]
    },
    pubsub: {
      title: 'Google Cloud Pub/Sub (plant-telemetry topic)',
      subtitle: 'asia-south1 (Mumbai) — Fully Managed Enterprise Message Broker',
      color: '#38bdf8',
      details: [
        'Central telemetry ingestion backbone for all industrial rotating equipment.',
        'Topic: plant-telemetry receives all sensor telemetry payloads.',
        'Two subscriptions fan-out messages to two separate Cloud Functions:',
        '  • plant-telemetry-store-readings → store-readings function (persists time-series readings).',
        '  • plant-telemetry-fault-check   → fault-handler function (real-time threshold monitor).',
        'Guaranteed at-least-once delivery with configurable ack deadline and 7-day retention.',
        'Dedicated topic plant-fault-alerts for critical incident notifications and event routing.'
      ]
    },
    firestore: {
      title: 'Google Cloud Firestore (3 Collections)',
      subtitle: 'Serverless NoSQL Document Store with TTL & Atomic Transactions',
      color: '#34d399',
      details: [
        'Cloud-native NoSQL database partitioned into 3 specialized collections:',
        'plant-readings: stores all sensor telemetry. expire_at field used by Firestore TTL policy to auto-purge after 7 days.',
        'plant-faults: documents keyed by {device_id}_{fault_id}. ACTIVE_MARKER document per device enforces uniqueness of open faults.',
        'plant-reports: keyed by fault_id. Stores GCS object path, SHA-256 hash, and on-chain tx_hash.',
        'Firestore transactional writes enforce exactly-one-open-fault-per-device via atomic get-then-set locking.',
        'Native mode Firestore in asia-south1 with automated multi-zone replication.'
      ]
    },
    functions: {
      title: 'Google Cloud Functions Gen 2 (2 Functions)',
      subtitle: 'Python 3.12 Serverless Microservices (256 MB)',
      color: '#fbbf24',
      details: [
        'Event-driven serverless compute responding to Pub/Sub Eventarc triggers.',
        'plant-fault-handler: triggered by plant-telemetry Pub/Sub subscription.',
        '  • Applies threshold gate: temperature > 90 OR vibration > 7 OR current > 12.',
        '  • Runs Firestore @transactional function: get ACTIVE_MARKER → if not exists, set fault + marker.',
        '  • Dispatches automated emergency email alert to reliability engineering staff.',
        'plant-store-readings: triggered by plant-telemetry subscription.',
        '  • Writes every payload to Firestore plant-readings with expire_at TTL field.',
        '  • Zero-maintenance serverless scaling from 0 to thousands of concurrent messages.',
        'IAM: plant-functions-sa has roles/datastore.user + roles/pubsub.publisher only.'
      ]
    },
    alerts: {
      title: 'Emergency Incident Alert Dispatch',
      subtitle: 'Automated Notification Pipeline via Cloud Functions',
      color: '#f87171',
      details: [
        'Direct automated alert notification pipeline.',
        'Cloud Functions fault-handler sends email via SMTP to on-call reliability engineers.',
        'Credentials stored securely in Google Secret Manager: plant-smtp-user, plant-smtp-pass.',
        'Alert contains: Fault ID, Machine, Device, Part, Metric, Recorded Value, Safety Limit, Time UTC.',
        'plant-fault-alerts Pub/Sub topic available for downstream integrations and mobile push.'
      ]
    },
    gcs: {
      title: 'Google Cloud Storage (Private Bucket)',
      subtitle: 'AES-256 Encrypted Object Store in asia-south1',
      color: '#38bdf8',
      details: [
        'Encrypted, immutable cloud repository for certified maintenance service PDFs.',
        'Bucket: plant-reports-<PROJECT_ID> with Uniform Bucket-Level Access (UBLA) enabled.',
        'Google-managed AES-256 encryption by default on all stored objects.',
        'Stores PDF maintenance reports at reports/{fault_id}.pdf.',
        'IAM: plant-compute-sa has roles/storage.objectAdmin on bucket only (least privilege).',
        'Lifecycle policy: automated archive management with nearline transitions.'
      ]
    },
    sepolia: {
      title: 'Ethereum Sepolia Blockchain',
      subtitle: 'ServiceReportRegistry Smart Contract (Solidity 0.8.x)',
      color: '#c084fc',
      details: [
        'Decentralized immutable verification station and cryptographic audit trail.',
        'Public persistent testnet (Chain ID 11155111) via Alchemy RPC.',
        'storeHash(bytes32 reportId, bytes32 fileHash): Owner-only transaction, prevents hash overwrite.',
        'verify(bytes32 reportId, bytes32 fileHash): Read-only view function, 0 Gas cost.',
        'Report ID = keccak256(fault_id); File Hash = SHA-256(PDF). Raw files never go on-chain.'
      ]
    }
  };

  const activeInfo = nodes[selectedNode] || nodes.pubsub;

  return (
    <div className="scada-panel" style={{ padding: '24px' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Network size={22} color="#38bdf8" />
          <h2 className="font-display" style={{ fontSize: '1.25rem', color: '#fff' }}>
            GOOGLE CLOUD & BLOCKCHAIN ARCHITECTURE PIPELINE
          </h2>
          <span className="status-badge nominal" style={{ fontSize: '0.68rem' }}>
            END-TO-END DATAFLOW TOPOLOGY
          </span>
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Interactive Google Cloud architecture map. Click any subsystem to view IAM roles, Firestore schemas, and verification mechanics.
          Production architecture leveraging Google Cloud native services in the Mumbai region (asia-south1) and Ethereum Sepolia.
        </p>
      </div>

      {/* Google Cloud Native Services Stack Badge Row */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        marginBottom: '20px',
        padding: '12px 16px',
        background: 'rgba(56, 189, 248, 0.06)',
        borderRadius: '10px',
        border: '1px solid rgba(56, 189, 248, 0.15)'
      }}>
        {[
          ['Cloud Pub/Sub', 'IoT Telemetry Broker', '#38bdf8'],
          ['Cloud Functions Gen 2', 'Serverless FaaS', '#fbbf24'],
          ['Cloud Firestore', 'NoSQL DB & TTL', '#34d399'],
          ['Cloud Storage', 'Secure Reports GCS', '#38bdf8'],
          ['Secret Manager', 'Key Management', '#c084fc'],
          ['Compute Engine', 'SCADA Host (IaaS)', '#a78bfa'],
          ['Firebase Hosting', 'Global Edge CDN', '#f59e0b'],
          ['Ethereum Sepolia', 'Smart Contract Proofs', '#c084fc'],
        ].map(([service, role, color]) => (
          <div key={service} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.7rem',
            background: 'rgba(0,0,0,0.3)',
            padding: '4px 10px',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.06)'
          }}>
            <span style={{ color, fontWeight: 700 }}>{service}</span>
            <span style={{ color: '#475569' }}>•</span>
            <span style={{ color: '#9ca3af' }}>{role}</span>
          </div>
        ))}
      </div>

      {/* Visual Pipeline Interactive Grid */}
      <div style={{
        background: 'rgba(11, 17, 33, 0.8)',
        borderRadius: '12px',
        border: '1px solid rgba(56, 189, 248, 0.2)',
        padding: '24px',
        position: 'relative',
        overflowX: 'auto',
        marginBottom: '24px'
      }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', gap: '20px', minWidth: '900px' }}>
          
          {/* Column 1: Edge */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="font-mono" style={{ fontSize: '0.72rem', color: '#38bdf8', letterSpacing: '0.06em' }}>
              LAYER 1: EDGE & SIMULATION
            </div>
            
            <div
              onClick={() => { sound.playClick(); setSelectedNode('devices'); }}
              style={{
                background: selectedNode === 'devices' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(0,0,0,0.4)',
                border: `1px solid ${selectedNode === 'devices' ? '#38bdf8' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '8px',
                padding: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Cpu size={18} color="#38bdf8" />
                <span className="font-display" style={{ fontSize: '0.88rem', color: '#fff', fontWeight: 600 }}>
                  8 IoT Devices
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Machine A & B (Service Account)
              </div>
              <div className="font-mono" style={{ fontSize: '0.68rem', color: '#38bdf8', marginTop: '6px' }}>
                Pub/Sub SDK • 10s
              </div>
            </div>
          </div>

          {/* Arrow 1 */}
          <div style={{ display: 'flex', alignItems: 'center', color: '#475569' }}>➔</div>

          {/* Column 2: Ingestion */}
          <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="font-mono" style={{ fontSize: '0.72rem', color: '#38bdf8', letterSpacing: '0.06em' }}>
              LAYER 2: GCP INGESTION
            </div>
            
            <div
              onClick={() => { sound.playClick(); setSelectedNode('pubsub'); }}
              style={{
                background: selectedNode === 'pubsub' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(0,0,0,0.4)',
                border: `1px solid ${selectedNode === 'pubsub' ? '#38bdf8' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '8px',
                padding: '12px 14px',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Radio size={16} color="#38bdf8" />
                <span className="font-display" style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>Cloud Pub/Sub</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>asia-south1 Mumbai</div>
            </div>

            <div
              onClick={() => { sound.playClick(); setSelectedNode('pubsub'); }}
              style={{
                background: selectedNode === 'pubsub' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(0,0,0,0.4)',
                border: `1px solid ${selectedNode === 'pubsub' ? '#38bdf8' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '8px',
                padding: '12px 14px',
                cursor: 'pointer'
              }}
            >
              <div className="font-display" style={{ fontSize: '0.82rem', color: '#fff', fontWeight: 600 }}>Fan-Out Subscriptions</div>
              <div className="font-mono" style={{ fontSize: '0.68rem', color: '#34d399', marginTop: '4px' }}>Sub 1: store-readings</div>
              <div className="font-mono" style={{ fontSize: '0.68rem', color: '#f87171' }}>Sub 2: fault-check</div>
            </div>
          </div>

          {/* Arrow 2 */}
          <div style={{ display: 'flex', alignItems: 'center', color: '#475569' }}>➔</div>

          {/* Column 3: Processing & Storage */}
          <div style={{ flex: 1.3, display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="font-mono" style={{ fontSize: '0.72rem', color: '#fbbf24', letterSpacing: '0.06em' }}>
              LAYER 3: COMPUTE & STORAGE
            </div>
            
            <div
              onClick={() => { sound.playClick(); setSelectedNode('functions'); }}
              style={{
                background: selectedNode === 'functions' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(0,0,0,0.4)',
                border: `1px solid ${selectedNode === 'functions' ? '#fbbf24' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '8px',
                padding: '10px 14px',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={15} color="#fbbf24" />
                <span className="font-display" style={{ fontSize: '0.82rem', color: '#fff', fontWeight: 600 }}>Cloud Functions (Gen 2)</span>
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Firestore transactional write</div>
            </div>

            <div
              onClick={() => { sound.playClick(); setSelectedNode('firestore'); }}
              style={{
                background: selectedNode === 'firestore' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(0,0,0,0.4)',
                border: `1px solid ${selectedNode === 'firestore' ? '#34d399' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '8px',
                padding: '10px 14px',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Database size={15} color="#34d399" />
                <span className="font-display" style={{ fontSize: '0.82rem', color: '#fff', fontWeight: 600 }}>Cloud Firestore</span>
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>readings / faults / reports</div>
            </div>

            <div
              onClick={() => { sound.playClick(); setSelectedNode('alerts'); }}
              style={{
                background: selectedNode === 'alerts' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(0,0,0,0.4)',
                border: `1px solid ${selectedNode === 'alerts' ? '#f87171' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '8px',
                padding: '8px 14px',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={14} color="#f87171" />
                <span className="font-display" style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 600 }}>SMTP Email Alert</span>
              </div>
            </div>
          </div>

          {/* Arrow 3 */}
          <div style={{ display: 'flex', alignItems: 'center', color: '#475569' }}>➔</div>

          {/* Column 4: Storage & Blockchain */}
          <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="font-mono" style={{ fontSize: '0.72rem', color: '#c084fc', letterSpacing: '0.06em' }}>
              LAYER 4: AUDIT & BLOCKCHAIN
            </div>
            
            <div
              onClick={() => { sound.playClick(); setSelectedNode('gcs'); }}
              style={{
                background: selectedNode === 'gcs' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(0,0,0,0.4)',
                border: `1px solid ${selectedNode === 'gcs' ? '#38bdf8' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '8px',
                padding: '12px 14px',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <HardDrive size={16} color="#38bdf8" />
                <span className="font-display" style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>Cloud Storage</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>reports/{'{fault}'}.pdf</div>
            </div>

            <div
              onClick={() => { sound.playClick(); setSelectedNode('sepolia'); }}
              style={{
                background: selectedNode === 'sepolia' ? 'rgba(168, 85, 247, 0.25)' : 'rgba(0,0,0,0.4)',
                border: `1px solid ${selectedNode === 'sepolia' ? '#c084fc' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '8px',
                padding: '14px',
                cursor: 'pointer',
                boxShadow: selectedNode === 'sepolia' ? '0 0 15px rgba(168, 85, 247, 0.3)' : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={18} color="#c084fc" />
                <span className="font-display" style={{ fontSize: '0.88rem', color: '#fff', fontWeight: 700 }}>Sepolia Testnet</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: '#e9d5ff', marginTop: '2px' }}>ServiceReportRegistry</div>
              <div className="font-mono" style={{ fontSize: '0.65rem', color: '#a855f7', marginTop: '4px' }}>storeHash() & verify()</div>
            </div>
          </div>

        </div>

      </div>

      {/* Selected Subsystem Detailed Inspector */}
      <div style={{
        background: 'rgba(0,0,0,0.3)',
        borderRadius: '10px',
        border: `1px solid ${activeInfo.color}44`,
        padding: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <h3 className="font-display" style={{ fontSize: '1.1rem', color: '#fff' }}>
              {activeInfo.title}
            </h3>
            <div className="font-mono" style={{ fontSize: '0.75rem', color: activeInfo.color }}>
              {activeInfo.subtitle}
            </div>
          </div>
          <span className="status-badge nominal" style={{ fontSize: '0.65rem' }}>
            ACTIVE GCP NODE
          </span>
        </div>

        <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {activeInfo.details.map((detail, idx) => (
            <li key={idx} style={{ fontSize: '0.82rem', color: '#e5e7eb', lineHeight: '1.5' }}>
              {detail}
            </li>
          ))}
        </ul>
      </div>

    </div>
  );
}
