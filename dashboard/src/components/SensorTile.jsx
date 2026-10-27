import React from 'react';
import { Activity, AlertTriangle, Zap, CheckCircle2, Flame, Gauge } from 'lucide-react';
import { sound } from '../utils/sound';

export default function SensorTile({ sensor, reading, isInjected, onInject, onClear }) {
  const value = reading?.value ?? (sensor.baselineMin + sensor.baselineMax) / 2;
  const status = reading?.status ?? 'NOMINAL';
  const history = reading?.history || [];

  // Generate SVG Sparkline Path
  const sparkWidth = 140;
  const sparkHeight = 36;
  let sparkPath = '';
  if (history.length > 1) {
    const minVal = Math.min(sensor.baselineMin * 0.9, ...history.map(h => h.value));
    const maxVal = Math.max(sensor.limit * 1.1, ...history.map(h => h.value));
    const range = (maxVal - minVal) || 1;

    const points = history.slice(-20).map((pt, idx, arr) => {
      const x = (idx / (arr.length - 1)) * sparkWidth;
      const y = sparkHeight - ((pt.value - minVal) / range) * sparkHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    sparkPath = `M ${points.join(' L ')}`;
  }

  const getStatusColor = () => {
    if (status === 'CRITICAL') return '#ef4444';
    if (status === 'WARNING') return '#f59e0b';
    return '#10b981';
  };

  const getIcon = () => {
    if (sensor.sensorType === 'temperature') return <Flame size={16} color={getStatusColor()} />;
    if (sensor.sensorType === 'current') return <Zap size={16} color={getStatusColor()} />;
    return <Gauge size={16} color={getStatusColor()} />;
  };

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.75)',
      borderRadius: '10px',
      border: `1px solid ${status === 'CRITICAL' ? 'rgba(239, 68, 68, 0.6)' : 'rgba(56, 189, 248, 0.15)'}`,
      boxShadow: status === 'CRITICAL' ? '0 0 20px rgba(239, 68, 68, 0.25)' : 'none',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      position: 'relative',
      overflow: 'hidden',
      transition: 'all 0.2s ease'
    }}>
      {/* Top Header */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {getIcon()}
            <div>
              <div className="font-mono" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8' }}>
                {sensor.deviceId}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {sensor.part}
              </div>
            </div>
          </div>
          <span className={`status-badge ${status.toLowerCase()}`} style={{ fontSize: '0.62rem', padding: '2px 6px' }}>
            {status}
          </span>
        </div>

        {/* Big Numeric Readout */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '10px 0 6px 0' }}>
          <span className="font-mono" style={{
            fontSize: '1.85rem',
            fontWeight: 700,
            color: getStatusColor(),
            letterSpacing: '-0.02em',
            textShadow: status === 'CRITICAL' ? '0 0 12px rgba(239,68,68,0.5)' : 'none'
          }}>
            {value.toFixed(1)}
          </span>
          <span className="font-mono" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {sensor.unit}
          </span>
        </div>

        {/* Limit Marker & Baselines */}
        <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-dim)', display: 'flex', justifyContent: 'space-between' }}>
          <span>Limit: &gt; {sensor.limit} {sensor.unit}</span>
          <span>Nom: {sensor.baselineMin}-{sensor.baselineMax}</span>
        </div>
      </div>

      {/* Mini Sparkline & Controls */}
      <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: sparkWidth, height: sparkHeight }}>
          {sparkPath ? (
            <svg width={sparkWidth} height={sparkHeight} style={{ overflow: 'visible' }}>
              <path
                d={sparkPath}
                fill="none"
                stroke={getStatusColor()}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Gathering data...</span>
          )}
        </div>

        <button
          onClick={() => {
            sound.playClick();
            isInjected ? onClear(sensor.deviceId) : onInject(sensor.deviceId);
          }}
          className={`scada-btn ${isInjected ? 'scada-btn-danger' : ''}`}
          style={{ padding: '4px 10px', fontSize: '0.68rem', height: '26px' }}
        >
          {isInjected ? 'Clear Anomaly' : 'Inject Spike'}
        </button>
      </div>

    </div>
  );
}
