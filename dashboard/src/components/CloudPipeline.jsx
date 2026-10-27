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
  const [selectedNode, setSelectedNode] = useState('iot');

  const nodes = {
    devices: {
      title: 'Device Simulator (8 Virtual IoT Things)',
      subtitle: 'Python 3.12 + AWS IoT Device SDK v2 (awsiotsdk)',
      color: '#38bdf8',
      details: [
        '8 physical Things registered in AWS IoT Core across 2 industrial machines.',
        'Machine A (Motor-Pump): A1-MOTOR-TEMP, A2-MOTOR-CURR, A3-MOTOR-VIB, A4-PUMP-VIB.',
        'Machine B (Conveyor): B1-MOTOR-TEMP, B2-MOTOR-CURR, B3-GBOX-VIB, B4-GBOX-TEMP.',
        'Each device authenticates via dedicated X.509 client certificate and private key (certs/).',
        'Publishes telemetry every 10s to topic: plant/{machine_id}/{device_id}/telemetry.',
        'Includes CLI: inject <device_id> to force anomalies and clear <device_id> to restore baseline.'
      ]
    },
    iot: {
      title: 'AWS IoT Core Message Broker & Rules Engine',
      subtitle: 'ap-south-1 (Mumbai) — Fully Managed MQTT Broker',
      color: '#38bdf8',
      details: [
        'High-throughput managed MQTT broker with TLS 1.3 mTLS device authentication.',
        'Topic hierarchy: plant/+/+/telemetry routed with MQTT QoS 1.',
        'Rule 1 (plant_rule1_readings): DynamoDBv2 action writing all sensor streams to plant-readings table with 7-day TTL.',
        'Rule 2 (plant_rule2_faults): Evaluates WHERE clauses for limit breaches (>90°C, >7 mm/s, >12A) and invokes Lambda.',
        'Zero-server message routing with automatic scaling.'
      ]
    },
    dynamo: {
      title: 'Amazon DynamoDB (3 Tables)',
      subtitle: 'Serverless Single-Digit Millisecond NoSQL Database',
      color: '#34d399',
      details: [
        'plant-readings: Partition key device_id (S), Sort key ts (N). expire_at TTL auto-purges after 7 days.',
        'plant-faults: Partition key device_id (S), Sort key fault_id (S). Stores active and resolved incidents.',
        'plant-reports: Partition key fault_id (S). Stores S3 object key, SHA-256 hash, and Sepolia transaction hash.',
        'Conditional Writes: Uses attribute_not_exists(device_id) on ACTIVE_MARKER items to enforce exactly one open fault per device.',
        'Provisioned 20 RCU / 20 WCU — 100% Free-Tier compliant.'
      ]
    },
    lambda: {
      title: 'AWS Lambda Fault Handler (plant-fault-handler)',
      subtitle: 'Python 3.12 | 128 MB Memory | 10s Timeout',
      color: '#fbbf24',
      details: [
        'Invoked synchronously by AWS IoT Core Rule 2 upon threshold breach.',
        'Executes atomic DynamoDB transaction (transact_write_items) to record fault and set ACTIVE marker.',
        'Suppresses duplicate alerts if an open fault already exists on the affected device.',
        'Constructs detailed incident report and triggers critical notification to Amazon SNS.',
        'Sub-second execution (~85ms average runtime).'
      ]
    },
    sns: {
      title: 'Amazon SNS (plant-fault-alerts)',
      subtitle: 'Critical Incident Notification Service',
      color: '#f87171',
      details: [
        'Topic ARN: arn:aws:sns:ap-south-1:...:plant-fault-alerts.',
        'Subscribed to on-call reliability engineers via Email protocol.',
        'Dispatches immediate email alerts containing Fault ID, Machine ID, Sensor Type, and Breach Value.',
        'Directs engineers to the Service Desk with clear remediation procedures.'
      ]
    },
    s3: {
      title: 'Amazon S3 Private Encrypted Bucket',
      subtitle: 'plant-reports-${AWS::AccountId} (Private)',
      color: '#a855f7',
      details: [
        'Stores immutable PDF service reports uploaded by field technicians.',
        'All Public Access Blocked (BlockPublicAcls, BlockPublicPolicy, IgnorePublicAcls, RestrictPublicBuckets).',
        'Server-Side Encryption with Amazon S3 Managed Keys (SSE-AES256).',
        'Lifecycle policy transitions older archives to S3 Standard-IA / Glacier.'
      ]
    },
    ec2: {
      title: 'Amazon EC2 Cloud Server (t3.micro)',
      subtitle: 'Ubuntu 24.04 LTS | systemd service on port 80',
      color: '#06b6d4',
      details: [
        'Hosts the SCADA React Dashboard & Digital Twin for operators.',
        'Managed via systemd service (aether-scada.service) on port 80.',
        'Automated provisioning via CloudFormation UserData bootstrap script.',
        'Secured via Security Group allowing HTTP (80), SSH (22), and dev (5173).',
        'IAM Instance Profile (plant-ec2-role) grants read access to DynamoDB, S3, and SSM.'
      ]
    },
    sepolia: {
      title: 'Ethereum Sepolia Blockchain Ledger',
      subtitle: 'Smart Contract: ServiceReportRegistry.sol (Chain ID 11155111)',
      color: '#c084fc',
      details: [
        'Contract Address: 0x8A791620dd6260079BF849Dc5567aDC3F2FdC318.',
        'function recordReport(string faultId, bytes32 reportHash, string technicianId) external.',
        'Cryptographic immutability: anchors SHA-256 PDF report hash directly into Ethereum blocks.',
        '0-Gas Public Verification: anyone can verify PDF authenticity against the ledger with zero transaction fees.'
      ]
    }
  };

  const handleNodeClick = (key) => {
    sound.playClick();
    setSelectedNode(key);
  };

  return (
    <div className="scada-card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="font-display" style={{ fontSize: '1.25rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Network size={22} color="var(--cyan-glow)" />
            AWS Cloud Architecture & Pipeline Topology
          </h2>
          <p className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Fully automated infrastructure provisioned in AWS ap-south-1 (Mumbai) + Ethereum Sepolia Testnet
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span className="status-badge" style={{ background: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)' }}>
            AWS ap-south-1
          </span>
          <span className="status-badge" style={{ background: 'rgba(192,132,252,0.1)', color: '#c084fc', border: '1px solid rgba(192,132,252,0.3)' }}>
            Sepolia 11155111
          </span>
        </div>
      </div>

      {/* Interactive Topology Diagram */}
      <div style={{
        background: 'rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        overflowX: 'auto'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: '780px', position: 'relative' }}>
          
          {/* Node 1: Devices */}
          <div 
            onClick={() => handleNodeClick('devices')}
            style={{
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '12px 14px',
              borderRadius: '10px',
              border: `2px solid ${selectedNode === 'devices' ? '#38bdf8' : 'rgba(56,189,248,0.3)'}`,
              background: selectedNode === 'devices' ? 'rgba(56,189,248,0.2)' : 'rgba(13,20,36,0.8)',
              transition: 'all 0.2s',
              minWidth: '110px'
            }}
          >
            <Radio size={24} color="#38bdf8" />
            <span className="font-display" style={{ fontSize: '0.75rem', color: '#fff', marginTop: '6px', fontWeight: 600 }}>IoT Things</span>
            <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>8 Sensors</span>
          </div>

          <div style={{ color: 'var(--cyan-glow)', fontSize: '0.8rem', fontWeight: 700 }}>➔</div>

          {/* Node 2: IoT Core */}
          <div 
            onClick={() => handleNodeClick('iot')}
            style={{
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '12px 14px',
              borderRadius: '10px',
              border: `2px solid ${selectedNode === 'iot' ? '#38bdf8' : 'rgba(56,189,248,0.3)'}`,
              background: selectedNode === 'iot' ? 'rgba(56,189,248,0.2)' : 'rgba(13,20,36,0.8)',
              transition: 'all 0.2s',
              minWidth: '110px'
            }}
          >
            <Cpu size={24} color="#38bdf8" />
            <span className="font-display" style={{ fontSize: '0.75rem', color: '#fff', marginTop: '6px', fontWeight: 600 }}>IoT Core</span>
            <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Rules 1 &amp; 2</span>
          </div>

          <div style={{ color: 'var(--cyan-glow)', fontSize: '0.8rem', fontWeight: 700 }}>➔</div>

          {/* Node 3: Lambda */}
          <div 
            onClick={() => handleNodeClick('lambda')}
            style={{
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '12px 14px',
              borderRadius: '10px',
              border: `2px solid ${selectedNode === 'lambda' ? '#fbbf24' : 'rgba(251,191,36,0.3)'}`,
              background: selectedNode === 'lambda' ? 'rgba(251,191,36,0.2)' : 'rgba(13,20,36,0.8)',
              transition: 'all 0.2s',
              minWidth: '110px'
            }}
          >
            <Zap size={24} color="#fbbf24" />
            <span className="font-display" style={{ fontSize: '0.75rem', color: '#fff', marginTop: '6px', fontWeight: 600 }}>Lambda</span>
            <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Fault Handler</span>
          </div>

          <div style={{ color: 'var(--cyan-glow)', fontSize: '0.8rem', fontWeight: 700 }}>➔</div>

          {/* Node 4: DynamoDB */}
          <div 
            onClick={() => handleNodeClick('dynamo')}
            style={{
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '12px 14px',
              borderRadius: '10px',
              border: `2px solid ${selectedNode === 'dynamo' ? '#34d399' : 'rgba(52,211,153,0.3)'}`,
              background: selectedNode === 'dynamo' ? 'rgba(52,211,153,0.2)' : 'rgba(13,20,36,0.8)',
              transition: 'all 0.2s',
              minWidth: '110px'
            }}
          >
            <Database size={24} color="#34d399" />
            <span className="font-display" style={{ fontSize: '0.75rem', color: '#fff', marginTop: '6px', fontWeight: 600 }}>DynamoDB</span>
            <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>3 Tables</span>
          </div>

          <div style={{ color: 'var(--cyan-glow)', fontSize: '0.8rem', fontWeight: 700 }}>➔</div>

          {/* Node 5: SNS */}
          <div 
            onClick={() => handleNodeClick('sns')}
            style={{
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '12px 14px',
              borderRadius: '10px',
              border: `2px solid ${selectedNode === 'sns' ? '#f87171' : 'rgba(248,113,113,0.3)'}`,
              background: selectedNode === 'sns' ? 'rgba(248,113,113,0.2)' : 'rgba(13,20,36,0.8)',
              transition: 'all 0.2s',
              minWidth: '110px'
            }}
          >
            <Mail size={24} color="#f87171" />
            <span className="font-display" style={{ fontSize: '0.75rem', color: '#fff', marginTop: '6px', fontWeight: 600 }}>SNS</span>
            <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Email Alerts</span>
          </div>

          <div style={{ color: 'var(--cyan-glow)', fontSize: '0.8rem', fontWeight: 700 }}>➔</div>

          {/* Node 6: Sepolia */}
          <div 
            onClick={() => handleNodeClick('sepolia')}
            style={{
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '12px 14px',
              borderRadius: '10px',
              border: `2px solid ${selectedNode === 'sepolia' ? '#c084fc' : 'rgba(192,132,252,0.3)'}`,
              background: selectedNode === 'sepolia' ? 'rgba(192,132,252,0.2)' : 'rgba(13,20,36,0.8)',
              transition: 'all 0.2s',
              minWidth: '110px'
            }}
          >
            <ShieldCheck size={24} color="#c084fc" />
            <span className="font-display" style={{ fontSize: '0.75rem', color: '#fff', marginTop: '6px', fontWeight: 600 }}>Sepolia</span>
            <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Smart Contract</span>
          </div>

        </div>
      </div>

      {/* Selected Component Inspection Panel */}
      {selectedNode && nodes[selectedNode] && (
        <div style={{
          background: 'rgba(13,20,36,0.6)',
          border: `1px solid ${nodes[selectedNode].color}50`,
          borderRadius: '10px',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <h3 className="font-display" style={{ fontSize: '1.05rem', color: nodes[selectedNode].color }}>
                {nodes[selectedNode].title}
              </h3>
              <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                {nodes[selectedNode].subtitle}
              </div>
            </div>
          </div>

          <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {nodes[selectedNode].details.map((detail, idx) => (
              <li key={idx} className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                {detail}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
