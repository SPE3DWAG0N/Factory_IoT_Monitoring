import React from 'react';
import { Mail, AlertTriangle, ArrowRight, X } from 'lucide-react';
import { sound } from '../utils/sound';

export default function SNSAlertBanner({ alert, onDismiss, onNavigateToService }) {
  if (!alert) return null;

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(127, 29, 29, 0.35))',
      border: '1px solid rgba(248, 113, 113, 0.6)',
      borderRadius: '10px',
      padding: '14px 20px',
      marginBottom: '16px',
      boxShadow: '0 0 25px rgba(239, 68, 68, 0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      flexWrap: 'wrap',
      animation: 'pulseCritical 2.5s infinite'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '8px',
          background: 'rgba(239, 68, 68, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid rgba(248, 113, 113, 0.5)'
        }}>
          <AlertTriangle size={20} color="#fca5a5" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="font-display" style={{ color: '#fca5a5', fontWeight: 700, fontSize: '0.9rem' }}>
              AMAZON SNS CRITICAL EMAIL ALERT DISPATCHED
            </span>
            <span className="font-mono" style={{ fontSize: '0.7rem', color: '#fecaca', background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: '4px' }}>
              ID: {alert.faultId}
            </span>
          </div>
          <div className="font-mono" style={{ fontSize: '0.78rem', color: '#fee2e2', marginTop: '2px' }}>
            Threshold Breach: <strong style={{ color: '#fff' }}>{alert.deviceId}</strong> ({alert.part}) reported{' '}
            <span style={{ color: '#f87171', fontWeight: 700 }}>{alert.triggerValue} {alert.unit}</span>{' '}
            (Safety Limit: {alert.limit} {alert.unit}). AWS Lambda triggered atomic fault recording.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={() => {
            sound.playClick();
            onNavigateToService(alert.faultId);
          }}
          className="scada-btn scada-btn-primary"
          style={{ padding: '6px 14px', fontSize: '0.8rem' }}
        >
          <span>Open in Service Desk</span>
          <ArrowRight size={14} />
        </button>
        <button
          onClick={() => {
            sound.playClick();
            onDismiss();
          }}
          className="scada-btn"
          style={{ padding: '6px 10px', background: 'rgba(0,0,0,0.3)' }}
          title="Dismiss notification banner"
        >
          <X size={16} color="#fca5a5" />
        </button>
      </div>
    </div>
  );
}
