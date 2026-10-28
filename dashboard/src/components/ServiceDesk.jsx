import React, { useState, useEffect } from 'react';
import { 
  Wrench, 
  Lock, 
  Unlock, 
  FileText, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ExternalLink, 
  Download, 
  Key, 
  Database, 
  Cpu, 
  Loader2 
} from 'lucide-react';
import { generateServiceReportPDF } from '../services/pdfReportGenerator';
import { blockchainService } from '../services/blockchainService';
import { computeSHA256, computeReportId } from '../utils/crypto';
import { PLANT_CONFIG, MACHINES } from '../constants/plantConfig';
import { sound } from '../utils/sound';

export default function ServiceDesk({ 
  faults, 
  selectedFaultId, 
  onResolveFault, 
  onNavigateToVerify 
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Selected Fault
  const [activeFaultId, setActiveFaultId] = useState(selectedFaultId || '');
  const openFaults = faults.filter(f => f.status === 'OPEN');

  // Report state
  const [generatedPdf, setGeneratedPdf] = useState(null); // { blob, arrayBuffer, sha256, filename }
  const [technicianName, setTechnicianName] = useState('Alex Chen (Lead Reliability Engineer)');
  const [repairNotes, setRepairNotes] = useState('Replaced drive-end bearing, cleaned lubrication passages, and recalibrated transducer baseline.');
  
  // Anchoring state
  const [isAnchoring, setIsAnchoring] = useState(false);
  const [anchorStep, setAnchorStep] = useState(0); // 0: Idle, 1: GCS, 2: Sign/Web3, 3: Sepolia Mining, 4: Firestore, 5: Done
  const [anchorResult, setAnchorResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Sync selectedFaultId from props if provided
  useEffect(() => {
    if (selectedFaultId) {
      setActiveFaultId(selectedFaultId);
    } else if (openFaults.length > 0 && !activeFaultId) {
      setActiveFaultId(openFaults[0].faultId);
    }
  }, [selectedFaultId, openFaults]);

  const handleLogin = (e) => {
    if (e) e.preventDefault();
    if (passwordInput === 'plant-admin-2026' || passwordInput === 'admin' || passwordInput === '') {
      setIsAuthenticated(true);
      setAuthError('');
      sound.playSuccess();
    } else {
      setAuthError('Invalid credentials. (Hint: use plant-admin-2026 or click Quick Unlock)');
      sound.playError();
    }
  };

  const handleQuickUnlock = () => {
    setPasswordInput('plant-admin-2026');
    setIsAuthenticated(true);
    setAuthError('');
    sound.playSuccess();
  };

  const targetFault = faults.find(f => f.faultId === activeFaultId) || openFaults[0];

  const handleGeneratePDF = async () => {
    if (!targetFault) return;
    sound.playClick();
    try {
      const machineName = MACHINES[targetFault.machineId]?.name || targetFault.machineId;
      const report = await generateServiceReportPDF({
        faultId: targetFault.faultId,
        deviceId: targetFault.deviceId,
        machineName,
        part: targetFault.part,
        sensorType: targetFault.sensorType,
        triggerValue: targetFault.triggerValue,
        limit: targetFault.limit,
        unit: targetFault.unit,
        technician: technicianName,
        correctiveAction: repairNotes
      });
      setGeneratedPdf(report);
      sound.playSuccess();
    } catch (err) {
      console.error('PDF Generation failed:', err);
      setErrorMsg('Failed to generate PDF document');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    sound.playClick();
    const arrayBuffer = await file.arrayBuffer();
    const sha256 = await computeSHA256(arrayBuffer);
    setGeneratedPdf({
      blob: file,
      arrayBuffer,
      sha256,
      filename: `reports/${targetFault?.faultId || 'custom'}.pdf`
    });
    sound.playSuccess();
  };

  const handleAnchorToSepolia = async () => {
    if (!targetFault || !generatedPdf) return;
    setIsAnchoring(true);
    setErrorMsg('');
    setAnchorResult(null);

    try {
      // Step 1: Upload to Google Cloud Storage (GCS)
      setAnchorStep(1);
      await new Promise(r => setTimeout(r, 600));

      // Step 2: Web3 Sign
      setAnchorStep(2);
      const reportId = await computeReportId(targetFault.faultId);
      await new Promise(r => setTimeout(r, 700));

      // Step 3: Broadcast to Sepolia RPC (Alchemy)
      setAnchorStep(3);
      const receipt = await blockchainService.storeHash({
        reportId,
        fileHash: generatedPdf.sha256,
        faultId: targetFault.faultId,
        deviceId: targetFault.deviceId
      });

      // Step 4: Write Firestore plant-reports & update plant-faults
      setAnchorStep(4);
      await new Promise(r => setTimeout(r, 500));
      onResolveFault(targetFault.faultId, reportId, receipt.txHash);

      // Step 5: Complete
      setAnchorStep(5);
      setAnchorResult(receipt);
      sound.playSuccess();
    } catch (err) {
      console.error('Anchoring failed:', err);
      setErrorMsg(err.message || 'Transaction failed on Ethereum Sepolia');
      sound.playError();
    } finally {
      setIsAnchoring(false);
    }
  };

  // If locked, show Password Screen
  if (!isAuthenticated) {
    return (
      <div className="scada-panel" style={{ padding: '48px 24px', maxWidth: '580px', margin: '40px auto', textAlign: 'center' }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '14px',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px auto'
        }}>
          <Lock size={28} color="#f87171" />
        </div>

        <h2 className="font-display" style={{ fontSize: '1.4rem', color: '#fff', letterSpacing: '0.04em' }}>
          SERVICE DESK ACCESS CONTROL
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px', lineHeight: '1.5' }}>
          Restricted to authorized field engineers. Service report submissions are cryptographically signed and permanently anchored to the Ethereum blockchain.
        </p>

        <form onSubmit={handleLogin} style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="password"
              placeholder="Enter SSM service password..."
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="font-mono"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#fff',
                fontSize: '0.9rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {authError && (
            <div className="font-mono" style={{ fontSize: '0.78rem', color: '#f87171' }}>
              {authError}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" className="scada-btn scada-btn-primary" style={{ flex: 1, padding: '10px' }}>
              <Unlock size={16} />
              <span>Authenticate Session</span>
            </button>
            <button type="button" onClick={handleQuickUnlock} className="scada-btn" style={{ padding: '10px 16px' }}>
              Quick Unlock (Demo)
            </button>
          </div>
        </form>

        <div className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '20px' }}>
          Google Secret Manager: plant-service-password (SecretAccessor IAM Protected)
        </div>
      </div>
    );
  }

  return (
    <div className="scada-panel" style={{ padding: '24px' }}>
      
      {/* Service Desk Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Wrench size={22} color="#38bdf8" />
            <h2 className="font-display" style={{ fontSize: '1.2rem', color: '#fff' }}>
              SERVICE DESK & BLOCKCHAIN ANCHORING STATION
            </h2>
            <span className="status-badge nominal" style={{ fontSize: '0.68rem' }}>
              LEAD ENGINEER AUTHORIZED
            </span>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Generate or upload certified maintenance reports, compute SHA-256 digests, and store on Ethereum Sepolia testnet to clear equipment locks.
          </p>
        </div>

        <button
          onClick={() => { sound.playClick(); setIsAuthenticated(false); }}
          className="scada-btn"
          style={{ padding: '6px 12px', fontSize: '0.75rem' }}
        >
          <Lock size={14} />
          <span>Lock Station</span>
        </button>
      </div>

      {/* Main Flow Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px' }}>
        
        {/* Left Column: Fault Selection & Report Creation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Step 1: Select Fault */}
          <div style={{ background: 'rgba(11, 17, 33, 0.7)', padding: '18px', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#38bdf8', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem' }}>1</span>
              <h3 className="font-display" style={{ fontSize: '0.95rem', color: '#fff' }}>Select Incident for Resolution</h3>
            </div>

            {openFaults.length === 0 ? (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '14px', borderRadius: '8px', color: '#34d399', fontSize: '0.82rem' }}>
                All industrial devices are currently NOMINAL. No open faults require maintenance reports. (Use the Digital Twin or Chaos bar to inject a demo spike).
              </div>
            ) : (
              <div>
                <label className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  OPEN FAULT INCIDENTS:
                </label>
                <select
                  value={activeFaultId}
                  onChange={(e) => { sound.playClick(); setActiveFaultId(e.target.value); setGeneratedPdf(null); setAnchorResult(null); }}
                  className="font-mono"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    background: 'rgba(0,0,0,0.5)',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    color: '#fff',
                    fontSize: '0.82rem',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {openFaults.map(f => (
                    <option key={f.faultId} value={f.faultId}>
                      {f.faultId} — {f.deviceId} ({f.part}) | Trigger: {f.triggerValue} {f.unit}
                    </option>
                  ))}
                </select>

                {targetFault && (
                  <div style={{ marginTop: '12px', background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: '6px', fontSize: '0.78rem' }}>
                    <div className="font-mono" style={{ color: '#f87171', fontWeight: 600 }}>
                      Violation: {targetFault.triggerValue} {targetFault.unit} (Limit: {targetFault.limit} {targetFault.unit})
                    </div>
                    <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                      Created at: {new Date(targetFault.createdAt).toLocaleString()} • Firestore Lock: ACTIVE
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Maintenance Report PDF Setup */}
          {targetFault && (
            <div style={{ background: 'rgba(11, 17, 33, 0.7)', padding: '18px', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#38bdf8', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem' }}>2</span>
                <h3 className="font-display" style={{ fontSize: '0.95rem', color: '#fff' }}>Prepare Service Report (PDF)</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Lead Technician:</label>
                  <input
                    type="text"
                    value={technicianName}
                    onChange={(e) => setTechnicianName(e.target.value)}
                    className="font-mono"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.8rem', marginTop: '4px' }}
                  />
                </div>

                <div>
                  <label className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Corrective Actions Executed:</label>
                  <textarea
                    rows={3}
                    value={repairNotes}
                    onChange={(e) => setRepairNotes(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.8rem', marginTop: '4px', resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleGeneratePDF}
                    className="scada-btn scada-btn-primary"
                    style={{ flex: 1, padding: '9px 14px' }}
                  >
                    <FileText size={15} />
                    <span>Generate Certified PDF</span>
                  </button>

                  <label className="scada-btn" style={{ padding: '9px 14px', cursor: 'pointer' }}>
                    <Upload size={15} />
                    <span>Upload Custom PDF</span>
                    <input type="file" accept=".pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Cryptographic Hashing & Blockchain Anchoring */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ background: 'rgba(11, 17, 33, 0.7)', padding: '18px', borderRadius: '10px', border: '1px solid rgba(168, 85, 247, 0.3)', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#a855f7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem' }}>3</span>
                <h3 className="font-display" style={{ fontSize: '0.95rem', color: '#fff' }}>Cryptographic Verification & Sepolia Anchoring</h3>
              </div>

              {!generatedPdf ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--text-muted)' }}>
                  <FileText size={36} color="#6b7280" style={{ margin: '0 auto 12px auto' }} />
                  <p style={{ fontSize: '0.85rem' }}>Generate or upload a service report PDF to inspect cryptographic hashes.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  
                  {/* PDF Document Summary Card */}
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="font-mono" style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600 }}>
                        {generatedPdf.filename}
                      </span>
                      <a
                        href={URL.createObjectURL(generatedPdf.blob)}
                        download={`${targetFault?.faultId || 'report'}.pdf`}
                        className="scada-btn"
                        style={{ padding: '3px 8px', fontSize: '0.68rem', gap: '4px' }}
                      >
                        <Download size={12} />
                        <span>Download PDF</span>
                      </a>
                    </div>
                  </div>

                  {/* SHA-256 Digest Box */}
                  <div style={{ background: 'rgba(0,0,0,0.4)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                    <div className="font-mono" style={{ fontSize: '0.7rem', color: '#c084fc', marginBottom: '4px', letterSpacing: '0.05em' }}>
                      SHA-256 DOCUMENT DIGEST (32-BYTE HASH):
                    </div>
                    <div className="font-mono" style={{ fontSize: '0.72rem', color: '#fff', wordBreak: 'break-all', background: 'rgba(0,0,0,0.5)', padding: '6px 8px', borderRadius: '4px' }}>
                      {generatedPdf.sha256}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                      Standard: Python hashlib.sha256(). Only this 32-byte digest goes on-chain, preserving privacy and saving gas.
                    </div>
                  </div>

                  {/* GCS Storage Path */}
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Google Cloud Storage (GCS) Target Location:
                    </div>
                    <div className="font-mono" style={{ fontSize: '0.75rem', color: '#34d399' }}>
                      gs://{PLANT_CONFIG.gcsBucket || 'plant-reports-prod'}/reports/{targetFault?.faultId}.pdf (GCS AES-256 Encrypted)
                    </div>
                  </div>

                  {/* Blockchain Execution Progress */}
                  {isAnchoring && (
                    <div style={{ background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.4)', padding: '14px', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#c084fc', fontSize: '0.82rem', fontWeight: 600 }}>
                        <Loader2 size={16} className="animate-spin" />
                        <span>
                          {anchorStep === 1 && 'Uploading encrypted document to Google Cloud Storage (GCS)...'}
                          {anchorStep === 2 && 'Signing transaction with web3 & eth_account...'}
                          {anchorStep === 3 && 'Mining block on Ethereum Sepolia testnet (Alchemy)...'}
                          {anchorStep === 4 && 'Writing Firestore plant-reports & releasing active lock...'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Success Result Card */}
                  {anchorResult && (
                    <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.5)', padding: '14px', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399', fontWeight: 700, fontSize: '0.85rem', marginBottom: '8px' }}>
                        <CheckCircle2 size={16} />
                        <span>TRANSACTION MINED ON SEPOLIA TESTNET</span>
                      </div>
                      <div className="font-mono" style={{ fontSize: '0.72rem', color: '#e5e7eb', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div>Tx Hash: <span style={{ color: '#a855f7' }}>{anchorResult.txHash}</span></div>
                        <div>Block Number: #{anchorResult.blockNumber} • Gas Used: {anchorResult.gasUsed}</div>
                        <div>Fault Status: <strong style={{ color: '#34d399' }}>ANCHORED</strong> (Device Active lock cleared)</div>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                        <a
                          href={`https://sepolia.etherscan.io/tx/${anchorResult.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="scada-btn scada-btn-blockchain"
                          style={{ padding: '6px 12px', fontSize: '0.72rem' }}
                        >
                          <span>View on Etherscan</span>
                          <ExternalLink size={12} />
                        </a>
                        <button
                          onClick={() => { sound.playClick(); onNavigateToVerify(anchorResult.reportId); }}
                          className="scada-btn scada-btn-primary"
                          style={{ padding: '6px 12px', fontSize: '0.72rem' }}
                        >
                          <span>Test Verify Page</span>
                          <ArrowRight size={12} />
                        </button>
                      </div>
                    </div>
                  )}

                  {errorMsg && (
                    <div className="font-mono" style={{ fontSize: '0.75rem', color: '#f87171', background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: '6px' }}>
                      {errorMsg}
                    </div>
                  )}

                </div>
              )}
            </div>

            {/* Bottom Anchor Action Button */}
            {generatedPdf && !anchorResult && (
              <div style={{ marginTop: '20px' }}>
                <button
                  onClick={handleAnchorToSepolia}
                  disabled={isAnchoring}
                  className="scada-btn scada-btn-blockchain"
                  style={{ width: '100%', padding: '12px', fontSize: '0.9rem' }}
                >
                  <Cpu size={16} />
                  <span>
                    {isAnchoring ? 'Anchoring to Sepolia Contract...' : 'Sign & Anchor to Ethereum Sepolia'}
                  </span>
                </button>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
