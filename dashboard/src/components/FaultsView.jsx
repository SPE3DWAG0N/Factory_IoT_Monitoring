import React, { useState } from 'react';
import { ShieldAlert, ArrowRight, ExternalLink, Lock, CheckCircle2, Clock, Filter } from 'lucide-react';
import { sound } from '../utils/sound';

export default function FaultsView({ faults, activeMarkers, onNavigateToService, onNavigateToVerify }) {
  const [filter, setFilter] = useState('ALL'); // 'ALL', 'OPEN', 'ANCHORED'

  const filteredFaults = faults.filter(f => {
    if (filter === 'OPEN') return f.status === 'OPEN';
    if (filter === 'ANCHORED') return f.status === 'ANCHORED';
    return true;
  });

  const openCount = faults.filter(f => f.status === 'OPEN').length;
  const anchoredCount = faults.filter(f => f.status === 'ANCHORED').length;

  return (
    <div className="scada-panel" style={{ padding: '24px' }}>
      
      {/* Header and Stat Tiles */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldAlert size={22} color="#f87171" />
            <h2 className="font-display" style={{ fontSize: '1.2rem', color: '#fff' }}>
              INCIDENT & FAULT AUDIT LOG (FIRESTORE: PLANT-FAULTS)
            </h2>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Continuous ingestion from Cloud Pub/Sub & Cloud Functions fault-handler. Enforces single active fault per device via Firestore transactions.
          </p>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
          {[
            { id: 'ALL', label: `All Events (${faults.length})` },
            { id: 'OPEN', label: `Open Actions (${openCount})` },
            { id: 'ANCHORED', label: `Anchored (${anchoredCount})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { sound.playClick(); setFilter(tab.id); }}
              className="scada-btn"
              style={{
                padding: '6px 12px',
                fontSize: '0.75rem',
                background: filter === tab.id ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                borderColor: filter === tab.id ? 'rgba(56, 189, 248, 0.5)' : 'transparent',
                color: filter === tab.id ? '#fff' : 'var(--text-muted)'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Metric Summary Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'rgba(11, 17, 33, 0.6)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <div className="font-mono" style={{ fontSize: '0.75rem', color: '#f87171' }}>OPEN ACTIVE FAULTS</div>
          <div className="font-mono" style={{ fontSize: '1.75rem', fontWeight: 700, color: openCount > 0 ? '#ef4444' : '#10b981', marginTop: '4px' }}>
            {openCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Requires certified service report
          </div>
        </div>

        <div style={{ background: 'rgba(11, 17, 33, 0.6)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
          <div className="font-mono" style={{ fontSize: '0.75rem', color: '#c084fc' }}>SEPOLIA ANCHORED REPORTS</div>
          <div className="font-mono" style={{ fontSize: '1.75rem', fontWeight: 700, color: '#c084fc', marginTop: '4px' }}>
            {anchoredCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Immutable SHA-256 hashes on-chain
          </div>
        </div>

        <div style={{ background: 'rgba(11, 17, 33, 0.6)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
          <div className="font-mono" style={{ fontSize: '0.75rem', color: '#38bdf8' }}>DEVICE ACTIVE LOCKS</div>
          <div className="font-mono" style={{ fontSize: '1.75rem', fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>
            {activeMarkers.length} / 8
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            attribute_not_exists conditional locks
          </div>
        </div>
      </div>

      {/* Faults Table */}
      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
        <table className="scada-table">
          <thead>
            <tr>
              <th>Fault ID</th>
              <th>Device & Part</th>
              <th>Breach Telemetry</th>
              <th>Created (UTC)</th>
              <th>Firestore Lock</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredFaults.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  No incident records matching the selected filter.
                </td>
              </tr>
            ) : (
              filteredFaults.map(fault => {
                const isOpen = fault.status === 'OPEN';
                const hasLock = activeMarkers.includes(fault.deviceId);

                return (
                  <tr key={fault.faultId}>
                    <td className="font-mono" style={{ color: '#fff', fontWeight: 700 }}>
                      {fault.faultId}
                    </td>
                    <td>
                      <div className="font-mono" style={{ color: '#38bdf8', fontWeight: 600 }}>{fault.deviceId}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fault.part}</div>
                    </td>
                    <td>
                      <span className="font-mono" style={{ color: '#f87171', fontWeight: 700 }}>
                        {fault.triggerValue} {fault.unit}
                      </span>{' '}
                      <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        (Limit: {fault.limit} {fault.unit})
                      </span>
                    </td>
                    <td className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {new Date(fault.createdAt).toLocaleString()}
                    </td>
                    <td>
                      {hasLock ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#f59e0b', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                          <Lock size={12} /> ACTIVE MARKER
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                          RELEASED
                        </span>
                      )}
                    </td>
                    <td>
                      {isOpen ? (
                        <span className="status-badge critical">
                          <span className="status-dot critical" style={{ width: '6px', height: '6px' }} />
                          OPEN
                        </span>
                      ) : (
                        <span className="status-badge anchored">
                          <CheckCircle2 size={12} color="#c084fc" />
                          ANCHORED
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {isOpen ? (
                        <button
                          onClick={() => { sound.playClick(); onNavigateToService(fault.faultId); }}
                          className="scada-btn scada-btn-primary"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                        >
                          <span>Service Desk</span>
                          <ArrowRight size={13} />
                        </button>
                      ) : (
                        <button
                          onClick={() => { sound.playClick(); onNavigateToVerify(fault.reportId); }}
                          className="scada-btn scada-btn-blockchain"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                        >
                          <span>Verify On-Chain</span>
                          <ExternalLink size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
