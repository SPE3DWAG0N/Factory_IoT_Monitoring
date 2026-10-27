import React, { useState } from 'react';
import { MACHINES } from '../constants/plantConfig';
import { LineChart, Sliders, Eye } from 'lucide-react';
import { sound } from '../utils/sound';

export default function TelemetryChart({ readings }) {
  const [activeMachine, setActiveMachine] = useState('MACHINE-A');
  const [selectedSensorType, setSelectedSensorType] = useState('all'); // 'all', 'temperature', 'vibration', 'current'

  const machine = MACHINES[activeMachine];
  const sensors = machine.sensors.filter(
    s => selectedSensorType === 'all' || s.sensorType === selectedSensorType
  );

  // Colors per sensor
  const sensorColors = {
    'A1-MOTOR-TEMP': '#f87171',
    'A2-MOTOR-CURR': '#38bdf8',
    'A3-MOTOR-VIB': '#34d399',
    'A4-PUMP-VIB': '#fbbf24',
    'B1-MOTOR-TEMP': '#f87171',
    'B2-MOTOR-CURR': '#38bdf8',
    'B3-GBOX-VIB': '#34d399',
    'B4-GBOX-TEMP': '#c084fc'
  };

  // Dimensions
  const svgWidth = 800;
  const svgHeight = 260;
  const padding = { top: 20, right: 30, bottom: 40, left: 50 };
  const chartWidth = svgWidth - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;

  // Compute domain across all visible sensors
  let allValues = [];
  sensors.forEach(s => {
    const history = readings[s.deviceId]?.history || [];
    history.forEach(h => allValues.push(h.value));
    allValues.push(s.limit);
  });

  const minVal = allValues.length ? Math.min(0, Math.floor(Math.min(...allValues) * 0.9)) : 0;
  const maxVal = allValues.length ? Math.ceil(Math.max(...allValues) * 1.15) : 100;
  const valRange = (maxVal - minVal) || 1;

  // Get timestamps from first sensor's history
  const sampleHistory = readings[sensors[0]?.deviceId]?.history || [];
  const totalPoints = sampleHistory.length || 1;

  return (
    <div className="scada-panel" style={{ padding: '24px' }}>
      
      {/* Chart Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <LineChart size={20} color="#38bdf8" />
            <h3 className="font-display" style={{ fontSize: '1.1rem', color: '#fff' }}>
              REAL-TIME MULTI-SENSOR WAVEFORM (LAST 60 READINGS)
            </h3>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            DynamoDB plant-readings stream visualizer. Auto-refreshes per plant telemetry interval.
          </p>
        </div>

        {/* Machine & Sensor Filter Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => { sound.playClick(); setActiveMachine('MACHINE-A'); }}
              className="scada-btn"
              style={{
                padding: '4px 10px',
                fontSize: '0.72rem',
                background: activeMachine === 'MACHINE-A' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                borderColor: activeMachine === 'MACHINE-A' ? 'rgba(56, 189, 248, 0.5)' : 'transparent',
                color: activeMachine === 'MACHINE-A' ? '#fff' : 'var(--text-muted)'
              }}
            >
              Machine A
            </button>
            <button
              onClick={() => { sound.playClick(); setActiveMachine('MACHINE-B'); }}
              className="scada-btn"
              style={{
                padding: '4px 10px',
                fontSize: '0.72rem',
                background: activeMachine === 'MACHINE-B' ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                borderColor: activeMachine === 'MACHINE-B' ? 'rgba(168, 85, 247, 0.5)' : 'transparent',
                color: activeMachine === 'MACHINE-B' ? '#fff' : 'var(--text-muted)'
              }}
            >
              Machine B
            </button>
          </div>

          <select
            value={selectedSensorType}
            onChange={(e) => { sound.playClick(); setSelectedSensorType(e.target.value); }}
            className="font-mono"
            style={{
              background: 'rgba(255,255,255,0.05)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              padding: '5px 8px',
              fontSize: '0.72rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Metrics</option>
            <option value="temperature">Temperature (°C)</option>
            <option value="vibration">Vibration (mm/s)</option>
            <option value="current">Current (A)</option>
          </select>
        </div>
      </div>

      {/* SVG Chart Surface */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: 'auto', minWidth: '600px' }}>
          
          {/* Background Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const y = padding.top + chartHeight * (1 - pct);
            const valLabel = (minVal + valRange * pct).toFixed(1);
            return (
              <g key={idx}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={svgWidth - padding.right}
                  y2={y}
                  stroke="rgba(255, 255, 255, 0.06)"
                  strokeDasharray="4 4"
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  fill="#6b7280"
                  fontSize="10"
                  textAnchor="end"
                  fontFamily="var(--font-mono)"
                >
                  {valLabel}
                </text>
              </g>
            );
          })}

          {/* Time axis ticks */}
          {sampleHistory.map((pt, idx) => {
            if (idx % 10 === 0 || idx === sampleHistory.length - 1) {
              const x = padding.left + (idx / Math.max(1, totalPoints - 1)) * chartWidth;
              return (
                <g key={idx}>
                  <line x1={x} y1={padding.top + chartHeight} x2={x} y2={padding.top + chartHeight + 6} stroke="#475569" />
                  <text
                    x={x}
                    y={padding.top + chartHeight + 18}
                    fill="#6b7280"
                    fontSize="9"
                    textAnchor="middle"
                    fontFamily="var(--font-mono)"
                  >
                    {pt.time}
                  </text>
                </g>
              );
            }
            return null;
          })}

          {/* Sensor Paths */}
          {sensors.map(s => {
            const history = readings[s.deviceId]?.history || [];
            if (history.length < 2) return null;

            const color = sensorColors[s.deviceId] || '#38bdf8';
            const points = history.map((pt, idx) => {
              const x = padding.left + (idx / Math.max(1, history.length - 1)) * chartWidth;
              const y = padding.top + chartHeight - ((pt.value - minVal) / valRange) * chartHeight;
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            });

            return (
              <g key={s.deviceId}>
                <path
                  d={`M ${points.join(' L ')}`}
                  fill="none"
                  stroke={color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
                />
                {/* Last reading pulse dot */}
                {points.length > 0 && (
                  <circle
                    cx={points[points.length - 1].split(',')[0]}
                    cy={points[points.length - 1].split(',')[1]}
                    r="4"
                    fill={color}
                  />
                )}
              </g>
            );
          })}

        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {sensors.map(s => {
          const color = sensorColors[s.deviceId] || '#38bdf8';
          const curVal = readings[s.deviceId]?.value ?? 0;
          return (
            <div key={s.deviceId} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: color }} />
              <span className="font-mono" style={{ fontSize: '0.78rem', color: '#fff' }}>{s.deviceId}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({s.name}):</span>
              <span className="font-mono" style={{ fontSize: '0.8rem', fontWeight: 700, color }}>
                {curVal.toFixed(1)} {s.unit}
              </span>
            </div>
          );
        })}
      </div>

    </div>
  );
}
