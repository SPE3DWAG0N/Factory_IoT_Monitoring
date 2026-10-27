import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Upload, 
  FileCheck, 
  ShieldCheck, 
  ExternalLink, 
  AlertTriangle, 
  FileX, 
  Fingerprint, 
  RefreshCw,
  Search,
  Sparkles
} from 'lucide-react';
import { blockchainService } from '../services/blockchainService';
import { computeSHA256, tamperBuffer, formatAddress, formatTxHash } from '../utils/crypto';
import { PLANT_CONFIG } from '../constants/plantConfig';
import { sound } from '../utils/sound';

export default function VerifyPortal({ prefilledReportId }) {
  const [reportIdInput, setReportIdInput] = useState(prefilledReportId || '');
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileHash, setFileHash] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [isTampered, setIsTampered] = useState(false);
  const [originalBuffer, setOriginalBuffer] = useState(null);
  const [anchoredReports, setAnchoredReports] = useState([]);

  useEffect(() => {
    setAnchoredReports(blockchainService.getAnchoredReports());
  }, []);

  useEffect(() => {
    if (prefilledReportId) {
      setReportIdInput(prefilledReportId);
      // Automatically load associated report if available
      const rep = blockchainService.getAnchoredReports().find(r => r.reportId === prefilledReportId);
      if (rep) {
        setFileHash(rep.fileHash);
      }
    }
  }, [prefilledReportId]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    sound.playClick();

    const buffer = await file.arrayBuffer();
    setOriginalBuffer(buffer);
    setIsTampered(false);

    const hash = await computeSHA256(buffer);
    setSelectedFile({
      name: file.name,
      size: (file.size / 1024).toFixed(1) + ' KB',
      buffer
    });
    setFileHash(hash);
    setVerificationResult(null);
  };

  const handleSelectSample = (record) => {
    sound.playClick();
    setReportIdInput(record.reportId);
    setFileHash(record.fileHash);
    setSelectedFile({
      name: `reports/${record.faultId || 'sample'}.pdf`,
      size: '28.4 KB',
      buffer: null
    });
    setVerificationResult(null);
    setIsTampered(false);
  };

  const handleTamperTest = async () => {
    sound.playAlarm();
    let corruptedHash;

    if (originalBuffer) {
      const tampered = tamperBuffer(originalBuffer);
      corruptedHash = await computeSHA256(tampered);
    } else {
      // Invert several hex characters to simulate modified document digest
      corruptedHash = fileHash.slice(0, 10) + 'beef' + fileHash.slice(14);
    }

    setFileHash(corruptedHash);
    setIsTampered(true);
    setVerificationResult(null);
  };

  const handleRestoreOriginal = async () => {
    sound.playClick();
    if (originalBuffer) {
      const origHash = await computeSHA256(originalBuffer);
      setFileHash(origHash);
    } else {
      const rec = anchoredReports.find(r => r.reportId === reportIdInput);
      if (rec) setFileHash(rec.fileHash);
    }
    setIsTampered(false);
    setVerificationResult(null);
  };

  const handleExecuteVerification = async () => {
    if (!fileHash) return;
    setIsVerifying(true);
    sound.playClick();

    try {
      const result = await blockchainService.verify(reportIdInput, fileHash);
      setVerificationResult(result);
      if (result.matched) {
        sound.playSuccess();
      } else {
        sound.playError();
      }
    } catch (err) {
      console.error('Verification error:', err);
      sound.playError();
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="scada-panel" style={{ padding: '24px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={24} color="#34d399" />
            <h2 className="font-display" style={{ fontSize: '1.25rem', color: '#fff' }}>
              PUBLIC BLOCKCHAIN VERIFICATION PORTAL
            </h2>
            <span className="status-badge nominal" style={{ fontSize: '0.68rem' }}>
              ETHEREUM SEPOLIA (FREE READ CALL)
            </span>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Open to independent auditors, clients, and regulators. Verifies tamper-proof authenticity by comparing the PDF's cryptographic SHA-256 digest with the public Sepolia contract.
          </p>
        </div>
      </div>

      {/* Main Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '24px' }}>
        
        {/* Left Column: Verification Input & Tamper Simulator */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Quick Select Anchor Record */}
          <div style={{ background: 'rgba(11, 17, 33, 0.7)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
            <div className="font-mono" style={{ fontSize: '0.72rem', color: '#38bdf8', marginBottom: '8px' }}>
              FAST-LOAD ANCHORED LEDGER RECORDS:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {anchoredReports.map(rec => (
                <div
                  key={rec.reportId}
                  onClick={() => handleSelectSample(rec)}
                  style={{
                    background: reportIdInput === rec.reportId ? 'rgba(6, 182, 212, 0.2)' : 'rgba(0,0,0,0.3)',
                    border: `1px solid ${reportIdInput === rec.reportId ? 'rgba(34, 211, 238, 0.5)' : 'rgba(255,255,255,0.06)'}`,
                    padding: '8px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div>
                    <span className="font-mono" style={{ fontSize: '0.78rem', color: '#fff', fontWeight: 600 }}>
                      {rec.faultId || 'Sample Record'}
                    </span>{' '}
                    <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      ({rec.deviceId || 'A3-MOTOR-VIB'})
                    </span>
                  </div>
                  <span className="status-badge anchored" style={{ fontSize: '0.65rem' }}>
                    Block #{rec.blockNumber}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Upload or Input PDF */}
          <div style={{ background: 'rgba(11, 17, 33, 0.7)', padding: '18px', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
            <h3 className="font-display" style={{ fontSize: '0.95rem', color: '#fff', marginBottom: '12px' }}>
              1. Document Input & SHA-256 Ingestion
            </h3>

            {/* Dropzone */}
            <label style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              borderRadius: '8px',
              border: '2px dashed rgba(56, 189, 248, 0.3)',
              background: 'rgba(0, 0, 0, 0.25)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              marginBottom: '14px'
            }}>
              <Upload size={28} color="#38bdf8" style={{ marginBottom: '8px' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>
                {selectedFile ? selectedFile.name : 'Upload Service Report PDF'}
              </span>
              <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {selectedFile ? `Size: ${selectedFile.size}` : 'Drag & drop or browse to inspect cryptographic hash'}
              </span>
              <input type="file" accept=".pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>

            {/* Report ID input */}
            <div style={{ marginBottom: '12px' }}>
              <label className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Report ID (keccak256(fault_id)):
              </label>
              <input
                type="text"
                placeholder="0x..."
                value={reportIdInput}
                onChange={(e) => setReportIdInput(e.target.value)}
                className="font-mono"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  fontSize: '0.78rem',
                  marginTop: '4px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Computed File Hash Readout */}
            {fileHash && (
              <div style={{ background: isTampered ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0,0,0,0.4)', border: `1px solid ${isTampered ? 'rgba(239,68,68,0.5)' : 'rgba(56,189,248,0.3)'}`, padding: '10px 12px', borderRadius: '6px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span className="font-mono" style={{ fontSize: '0.7rem', color: isTampered ? '#f87171' : '#38bdf8', letterSpacing: '0.05em' }}>
                    CLIENT COMPUTED SHA-256 DIGEST:
                  </span>
                  {isTampered && (
                    <span className="status-badge critical" style={{ fontSize: '0.62rem' }}>
                      TAMPERED BIT INJECTED
                    </span>
                  )}
                </div>
                <div className="font-mono" style={{ fontSize: '0.72rem', color: isTampered ? '#fca5a5' : '#fff', wordBreak: 'break-all' }}>
                  {fileHash}
                </div>
              </div>
            )}

            {/* Tamper Demonstration Controls */}
            {fileHash && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                {!isTampered ? (
                  <button
                    onClick={handleTamperTest}
                    className="scada-btn scada-btn-danger"
                    style={{ flex: 1, padding: '8px', fontSize: '0.75rem' }}
                    title="Intentionally alter 1 byte in the PDF to test cryptographic collision resistance"
                  >
                    <AlertTriangle size={14} />
                    <span>Test Tamper (Flip 1 Byte)</span>
                  </button>
                ) : (
                  <button
                    onClick={handleRestoreOriginal}
                    className="scada-btn scada-btn-primary"
                    style={{ flex: 1, padding: '8px', fontSize: '0.75rem' }}
                  >
                    <RefreshCw size={14} />
                    <span>Restore Authentic File</span>
                  </button>
                )}
              </div>
            )}

            {/* Verify Action Button */}
            <button
              onClick={handleExecuteVerification}
              disabled={isVerifying || !fileHash}
              className="scada-btn scada-btn-blockchain"
              style={{ width: '100%', padding: '12px', fontSize: '0.9rem' }}
            >
              <Fingerprint size={18} />
              <span>{isVerifying ? 'Calling Sepolia Smart Contract...' : 'Verify Cryptographic Authenticity'}</span>
            </button>

          </div>

        </div>

        {/* Right Column: Verification Certificate & Smart Contract Audit Result */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ background: 'rgba(11, 17, 33, 0.7)', padding: '20px', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.2)', height: '100%' }}>
            <h3 className="font-display" style={{ fontSize: '0.95rem', color: '#fff', marginBottom: '16px' }}>
              2. On-Chain Smart Contract Audit Result
            </h3>

            {!verificationResult ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <ShieldCheck size={48} color="#475569" style={{ margin: '0 auto 16px auto' }} />
                <p style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
                  Awaiting document hash and verification request.
                </p>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                  Sepolia read-only call consumes 0 Gas and executes instantaneously.
                </p>
              </div>
            ) : verificationResult.matched ? (
              /* MATCH CASE - GREEN CERTIFICATE */
              <div style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(6, 78, 59, 0.25))',
                border: '1px solid rgba(52, 211, 153, 0.6)',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 0 30px rgba(16, 185, 129, 0.25)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.3)', border: '2px solid #34d399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle2 size={26} color="#34d399" />
                  </div>
                  <div>
                    <span className="font-display" style={{ fontSize: '1.2rem', fontWeight: 700, color: '#34d399' }}>
                      CRYPTOGRAPHIC MATCH CONFIRMED
                    </span>
                    <div className="font-mono" style={{ fontSize: '0.75rem', color: '#a7f3d0' }}>
                      Status: 100% Tamper-Proof Authentic
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: '0.82rem', color: '#d1fae5', lineHeight: '1.5', marginBottom: '16px' }}>
                  The submitted PDF document hash matches the immutable state stored on the Ethereum Sepolia public blockchain. The report has never been modified or altered since original anchoring.
                </p>

                {/* Proof Details */}
                <div style={{ background: 'rgba(0,0,0,0.4)', padding: '14px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="font-mono" style={{ fontSize: '0.72rem', color: '#e5e7eb' }}>
                    <strong>Smart Contract:</strong> <span style={{ color: '#38bdf8' }}>{formatAddress(PLANT_CONFIG.contractAddress)}</span>
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.72rem', color: '#e5e7eb' }}>
                    <strong>Sepolia Block:</strong> #{verificationResult.record?.blockNumber || '7192840'}
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.72rem', color: '#e5e7eb' }}>
                    <strong>Anchored At:</strong> {new Date(verificationResult.record?.timestamp || Date.now()).toLocaleString()}
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.72rem', color: '#e5e7eb' }}>
                    <strong>Gas Consumed:</strong> {verificationResult.record?.gasUsed || 47820} units
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.72rem', color: '#e5e7eb' }}>
                    <strong>Transaction Hash:</strong>{' '}
                    <span style={{ color: '#c084fc' }}>{formatTxHash(verificationResult.record?.txHash)}</span>
                  </div>
                </div>

                <div style={{ marginTop: '16px' }}>
                  <a
                    href={`https://sepolia.etherscan.io/tx/${verificationResult.record?.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="scada-btn scada-btn-blockchain"
                    style={{ width: '100%', padding: '10px' }}
                  >
                    <span>Inspect On Etherscan Sepolia</span>
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            ) : (
              /* MISMATCH CASE - RED FRAUD WARNING */
              <div style={{
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(127, 29, 29, 0.35))',
                border: '1px solid rgba(248, 113, 113, 0.7)',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 0 35px rgba(239, 68, 68, 0.35)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.3)', border: '2px solid #f87171', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <XCircle size={26} color="#f87171" />
                  </div>
                  <div>
                    <span className="font-display" style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f87171' }}>
                      CRYPTOGRAPHIC MISMATCH / FORGERY
                    </span>
                    <div className="font-mono" style={{ fontSize: '0.75rem', color: '#fca5a5' }}>
                      Status: Integrity Check FAILED
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: '0.82rem', color: '#fee2e2', lineHeight: '1.5', marginBottom: '16px' }}>
                  {verificationResult.details}
                </p>

                {verificationResult.record && (
                  <div style={{ background: 'rgba(0,0,0,0.5)', padding: '14px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div className="font-mono" style={{ fontSize: '0.7rem', color: '#34d399' }}>
                      REGISTERED ON-CHAIN HASH:
                      <div style={{ wordBreak: 'break-all', marginTop: '2px' }}>{verificationResult.record.fileHash}</div>
                    </div>
                    <div className="font-mono" style={{ fontSize: '0.7rem', color: '#f87171', marginTop: '4px' }}>
                      SUBMITTED FILE HASH:
                      <div style={{ wordBreak: 'break-all', marginTop: '2px' }}>{fileHash}</div>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                  <button
                    onClick={handleRestoreOriginal}
                    className="scada-btn scada-btn-primary"
                    style={{ flex: 1, padding: '10px' }}
                  >
                    <RefreshCw size={14} />
                    <span>Reset & Re-verify Authentic File</span>
                  </button>
                </div>
              </div>
            )}

            {/* Architecture note */}
            <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '20px', lineHeight: '1.5' }}>
              ServiceReportRegistry: verify(bytes32 reportId, bytes32 fileHash) returns (bool). Pure view function. Zero gas required for verification.
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
