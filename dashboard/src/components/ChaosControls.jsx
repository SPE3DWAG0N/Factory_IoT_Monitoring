import React from 'react';
import { Zap, AlertOctagon, RefreshCw, CheckCircle, ShieldAlert } from 'lucide-react';
import { sound } from '../utils/sound';

export default function ChaosControls({ injectedSensors, onInject, onClearAll, onResetDemo }) {
  const injectionPresets = [
    { id: 'A1-MOTOR-TEMP', label: 'A1 Motor Temp (>90°C)', unit: '°C' },
    { id: 'A3-MOTOR-VIB', label: 'A3 Bearing Vib (>7mm/s)', unit: 'mm/s' },
    { id: 'B3-GBOX-VIB', label: 'B3 Gearbox Vib (>7mm/s)', unit: 'mm/s' },
    { id: 'B2-MOTOR-CURR', label: 'B2 Motor Curr (>12A)', unit: 'A' },
  ];

  return (
    <div style={{
      background: 'rgba(13, 20, 36, 0.95)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(56, 189, 248, 0.25)',
      borderRadius: '12px',
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '14px',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)'
    }}>
      
      {/* Title & Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(248, 113, 113, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Zap size={16} color="#f87171" />
        </div>
        <div>
          <div className="font-display" style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>
            DEMO SIMULATION CONSOLE (CHAOS TESTING)
          </div>
          <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Simulate terminal commands: inject &lt;device_id&gt; / clear &lt;device_id&gt;
          </div>
        </div>
      </div>

      {/* Quick Injection Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {injectionPresets.map(preset => {
          const isActive = injectedSensors.includes(preset.id);
          return (
            <button
              key={preset.id}
              onClick={() => {
                sound.playClick();
                onInject(preset.id);
              }}
              className={`scada-btn ${isActive ? 'scada-btn-danger' : ''}`}
              style={{ padding: '6px 12px', fontSize: '0.75rem', height: '32px' }}
            >
              <Zap size={12} color={isActive ? '#fff' : '#f87171'} />
              <span>{preset.label}</span>
            </button>
          );
        })}

        {injectedSensors.length > 0 && (
          <button
            onClick={() => {
              sound.playClick();
              onClearAll();
            }}
            className="scada-btn scada-btn-primary"
            style={{ padding: '6px 12px', fontSize: '0.75rem', height: '32px' }}
          >
            <CheckCircle size={14} />
            <span>Restore All Baselines</span>
          </button>
        )}

        <button
          onClick={() => {
            sound.playClick();
            onResetDemo();
          }}
          className="scada-btn"
          style={{ padding: '6px 10px', fontSize: '0.72rem', height: '32px', color: 'var(--text-muted)' }}
          title="Reset local fault logs and demo state"
        >
          <RefreshCw size={13} />
          <span>Reset Demo</span>
        </button>
      </div>

    </div>
  );
}
