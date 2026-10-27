import React, { useState } from 'react';
import { MACHINES } from '../constants/plantConfig';
import { Zap, AlertTriangle, CheckCircle, RefreshCw, Layers } from 'lucide-react';
import { sound } from '../utils/sound';

export default function DigitalTwin({ readings, injectedSensors, onInject, onClear }) {
  const [selectedMachine, setSelectedMachine] = useState('ALL'); // 'ALL', 'MACHINE-A', 'MACHINE-B'
  const [selectedSensor, setSelectedSensor] = useState(null);

  const getSensorStatus = (deviceId) => {
    const reading = readings[deviceId];
    if (!reading) return 'NOMINAL';
    return reading.status;
  };

  const getStatusColor = (status) => {
    if (status === 'CRITICAL') return '#ef4444';
    if (status === 'WARNING') return '#f59e0b';
    return '#10b981';
  };

  const isSensorInjected = (deviceId) => injectedSensors.includes(deviceId);

  return (
    <div className="scada-panel" style={{ padding: '24px' }}>
      
      {/* Top Controls Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Layers size={20} color="#22d3ee" />
            <h2 className="font-display" style={{ fontSize: '1.15rem', color: '#fff', letterSpacing: '0.04em' }}>
              INTERACTIVE INDUSTRIAL DIGITAL TWIN
            </h2>
            <span className="status-badge nominal" style={{ fontSize: '0.68rem' }}>
              PHYSICAL ASSET MAPPING
            </span>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Real-time telemetry overlay on mechanical schematics. Click any sensor node to inspect baseline tolerances or inject limit breaches.
          </p>
        </div>

        {/* Machine Filter Toggle */}
        <div style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
          {[
            { id: 'ALL', label: 'Plant Overview (Both)' },
            { id: 'MACHINE-A', label: 'Machine A: Motor-Pump' },
            { id: 'MACHINE-B', label: 'Machine B: Conveyor' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                sound.playClick();
                setSelectedMachine(tab.id);
              }}
              className="scada-btn"
              style={{
                padding: '6px 12px',
                fontSize: '0.75rem',
                background: selectedMachine === tab.id ? 'rgba(6, 182, 212, 0.25)' : 'transparent',
                borderColor: selectedMachine === tab.id ? 'rgba(34, 211, 238, 0.5)' : 'transparent',
                color: selectedMachine === tab.id ? '#fff' : 'var(--text-muted)'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Machines */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: selectedMachine === 'ALL' ? 'repeat(auto-fit, minmax(480px, 1fr))' : '1fr',
        gap: '24px'
      }}>

        {/* ================= MACHINE A: MOTOR-PUMP ================= */}
        {(selectedMachine === 'ALL' || selectedMachine === 'MACHINE-A') && (
          <div style={{
            background: 'rgba(11, 17, 33, 0.7)',
            borderRadius: '12px',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            padding: '20px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Header info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <span className="font-mono" style={{ fontSize: '0.72rem', color: '#38bdf8', letterSpacing: '0.08em' }}>ASSET #MPS-101</span>
                <h3 className="font-display" style={{ fontSize: '1rem', color: '#fff' }}>Machine A: Motor-Pump Set</h3>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['A1-MOTOR-TEMP', 'A2-MOTOR-CURR', 'A3-MOTOR-VIB', 'A4-PUMP-VIB'].some(id => getSensorStatus(id) === 'CRITICAL') ? (
                  <span className="status-badge critical">FAULT ACTIVE</span>
                ) : (
                  <span className="status-badge nominal">OPTIMAL</span>
                )}
              </div>
            </div>

            {/* SVG Visualizer for Motor-Pump */}
            <div style={{ width: '100%', height: '260px', position: 'relative', background: 'radial-gradient(circle at center, rgba(6, 182, 212, 0.04) 0%, transparent 70%)', borderRadius: '8px' }}>
              <svg viewBox="0 0 600 280" style={{ width: '100%', height: '100%' }}>
                <defs>
                  <linearGradient id="motorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1e293b" />
                    <stop offset="100%" stopColor="#0f172a" />
                  </linearGradient>
                  <linearGradient id="pumpGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#334155" />
                    <stop offset="100%" stopColor="#1e293b" />
                  </linearGradient>
                  <radialGradient id="heatGlowA" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor={getSensorStatus('A1-MOTOR-TEMP') === 'CRITICAL' ? 'rgba(239,68,68,0.5)' : 'rgba(16,185,129,0.05)'} />
                    <stop offset="100%" stopColor="transparent" />
                  </radialGradient>
                </defs>

                {/* Stator Heat Glow */}
                <ellipse cx="140" cy="140" rx="90" ry="70" fill="url(#heatGlowA)" />

                {/* Ground Foundation */}
                <rect x="20" y="215" width="560" height="12" fill="#1e293b" stroke="#334155" strokeWidth="1" rx="3" />
                <line x1="20" y1="227" x2="580" y2="227" stroke="rgba(56, 189, 248, 0.3)" strokeDasharray="4 4" />

                {/* Motor Base & Stator Housing */}
                <rect x="60" y="80" width="160" height="120" rx="10" fill="url(#motorGrad)" stroke="#38bdf8" strokeWidth="1.5" />
                
                {/* Motor Cooling Fins */}
                {[95, 110, 125, 140, 155, 170, 185].map((y, idx) => (
                  <line key={idx} x1="70" y1={y} x2="210" y2={y} stroke="#334155" strokeWidth="2" />
                ))}

                {/* Motor Terminal Junction Box (A2 Current) */}
                <rect x="110" y="55" width="60" height="25" rx="4" fill="#0f172a" stroke="#22d3ee" strokeWidth="1.5" />
                <text x="140" y="71" fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="var(--font-mono)">POWER IN</text>

                {/* Drive Shaft & Flexible Coupling */}
                <rect x="220" y="130" width="100" height="20" fill="#64748b" stroke="#94a3b8" strokeWidth="1" />
                {/* Coupling Hub (A3 Motor DE Bearing) */}
                <rect x="210" y="115" width="24" height="50" rx="3" fill="#475569" stroke="#cbd5e1" strokeWidth="1" />
                <rect x="250" y="120" width="20" height="40" rx="3" fill="#334155" stroke="#94a3b8" strokeWidth="1" />

                {/* Centrifugal Pump Volute Casing */}
                <circle cx="390" cy="140" r="55" fill="url(#pumpGrad)" stroke="#38bdf8" strokeWidth="1.5" />
                <circle cx="390" cy="140" r="42" fill="#0f172a" stroke="#475569" strokeWidth="1" />

                {/* Rotating Impeller Blades in Pump */}
                <g transform="translate(390, 140)">
                  <g style={{
                    transformOrigin: 'center',
                    animation: isSensorInjected('A3-MOTOR-VIB') || isSensorInjected('A4-PUMP-VIB')
                      ? 'spinFast 0.4s linear infinite'
                      : 'spinSlow 1.8s linear infinite'
                  }}>
                    <line x1="-30" y1="0" x2="30" y2="0" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
                    <line x1="0" y1="-30" x2="0" y2="30" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
                    <circle cx="0" cy="0" r="10" fill="#06b6d4" />
                  </g>
                </g>

                {/* Suction & Discharge Pipes */}
                {/* Suction Inlet (Left or Center) */}
                <rect x="320" y="130" width="30" height="20" fill="#334155" stroke="#64748b" />
                {/* Discharge Flange (Top) */}
                <rect x="375" y="45" width="30" height="40" fill="#334155" stroke="#38bdf8" strokeWidth="1.5" />
                <rect x="365" y="40" width="50" height="8" rx="2" fill="#475569" stroke="#94a3b8" />
                <text x="390" y="32" fill="#38bdf8" fontSize="9" textAnchor="middle" fontFamily="var(--font-mono)">DISCHARGE</text>

                {/* ================= SENSOR OVERLAY NODES ================= */}
                {/* A1: Motor Winding Temp */}
                <g 
                  onClick={() => { sound.playClick(); setSelectedSensor('A1-MOTOR-TEMP'); }} 
                  style={{ cursor: 'pointer' }}
                >
                  <circle cx="100" cy="140" r="14" fill="#0b1120" stroke={getStatusColor(getSensorStatus('A1-MOTOR-TEMP'))} strokeWidth="2.5" />
                  <circle cx="100" cy="140" r="6" fill={getStatusColor(getSensorStatus('A1-MOTOR-TEMP'))} />
                  <rect x="40" y="165" width="120" height="22" rx="4" fill="rgba(0,0,0,0.85)" stroke={getStatusColor(getSensorStatus('A1-MOTOR-TEMP'))} strokeWidth="1" />
                  <text x="100" y="180" fill="#fff" fontSize="10" textAnchor="middle" fontFamily="var(--font-mono)" fontWeight="700">
                    A1: {readings['A1-MOTOR-TEMP']?.value || '65.0'} °C
                  </text>
                </g>

                {/* A2: Motor Supply Current */}
                <g 
                  onClick={() => { sound.playClick(); setSelectedSensor('A2-MOTOR-CURR'); }} 
                  style={{ cursor: 'pointer' }}
                >
                  <circle cx="140" cy="55" r="12" fill="#0b1120" stroke={getStatusColor(getSensorStatus('A2-MOTOR-CURR'))} strokeWidth="2" />
                  <circle cx="140" cy="55" r="5" fill={getStatusColor(getSensorStatus('A2-MOTOR-CURR'))} />
                  <rect x="180" y="45" width="95" height="20" rx="4" fill="rgba(0,0,0,0.85)" stroke={getStatusColor(getSensorStatus('A2-MOTOR-CURR'))} strokeWidth="1" />
                  <text x="227" y="59" fill="#fff" fontSize="10" textAnchor="middle" fontFamily="var(--font-mono)" fontWeight="700">
                    A2: {readings['A2-MOTOR-CURR']?.value || '8.5'} A
                  </text>
                </g>

                {/* A3: Motor Drive-End Bearing Vibration */}
                <g 
                  onClick={() => { sound.playClick(); setSelectedSensor('A3-MOTOR-VIB'); }} 
                  style={{ cursor: 'pointer' }}
                >
                  <circle cx="222" cy="105" r="13" fill="#0b1120" stroke={getStatusColor(getSensorStatus('A3-MOTOR-VIB'))} strokeWidth="2.5" />
                  <circle cx="222" cy="105" r="5" fill={getStatusColor(getSensorStatus('A3-MOTOR-VIB'))} />
                  <rect x="180" y="195" width="110" height="22" rx="4" fill="rgba(0,0,0,0.85)" stroke={getStatusColor(getSensorStatus('A3-MOTOR-VIB'))} strokeWidth="1" />
                  <text x="235" y="210" fill="#fff" fontSize="10" textAnchor="middle" fontFamily="var(--font-mono)" fontWeight="700">
                    A3: {readings['A3-MOTOR-VIB']?.value || '3.2'} mm/s
                  </text>
                </g>

                {/* A4: Pump Bearing Vibration */}
                <g 
                  onClick={() => { sound.playClick(); setSelectedSensor('A4-PUMP-VIB'); }} 
                  style={{ cursor: 'pointer' }}
                >
                  <circle cx="455" cy="140" r="13" fill="#0b1120" stroke={getStatusColor(getSensorStatus('A4-PUMP-VIB'))} strokeWidth="2.5" />
                  <circle cx="455" cy="140" r="5" fill={getStatusColor(getSensorStatus('A4-PUMP-VIB'))} />
                  <rect x="420" y="195" width="115" height="22" rx="4" fill="rgba(0,0,0,0.85)" stroke={getStatusColor(getSensorStatus('A4-PUMP-VIB'))} strokeWidth="1" />
                  <text x="477" y="210" fill="#fff" fontSize="10" textAnchor="middle" fontFamily="var(--font-mono)" fontWeight="700">
                    A4: {readings['A4-PUMP-VIB']?.value || '3.4'} mm/s
                  </text>
                </g>
              </svg>
            </div>

            {/* Quick Action Buttons for Machine A */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '12px' }}>
              {MACHINES['MACHINE-A'].sensors.map(s => {
                const isInjected = isSensorInjected(s.deviceId);
                const status = getSensorStatus(s.deviceId);
                return (
                  <div key={s.deviceId} style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{s.deviceId}</div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.name}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                      <span className="font-mono" style={{ fontSize: '0.75rem', fontWeight: 700, color: getStatusColor(status) }}>
                        {readings[s.deviceId]?.value} {s.unit}
                      </span>
                      <button
                        onClick={() => {
                          sound.playClick();
                          isInjected ? onClear(s.deviceId) : onInject(s.deviceId);
                        }}
                        className={`scada-btn ${isInjected ? 'scada-btn-danger' : ''}`}
                        style={{ padding: '3px 8px', fontSize: '0.65rem' }}
                      >
                        {isInjected ? 'Clear' : 'Inject'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= MACHINE B: CONVEYOR DRIVE ================= */}
        {(selectedMachine === 'ALL' || selectedMachine === 'MACHINE-B') && (
          <div style={{
            background: 'rgba(11, 17, 33, 0.7)',
            borderRadius: '12px',
            border: '1px solid rgba(168, 85, 247, 0.2)',
            padding: '20px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Header info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <span className="font-mono" style={{ fontSize: '0.72rem', color: '#c084fc', letterSpacing: '0.08em' }}>ASSET #CNV-204</span>
                <h3 className="font-display" style={{ fontSize: '1rem', color: '#fff' }}>Machine B: Conveyor Drive</h3>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['B1-MOTOR-TEMP', 'B2-MOTOR-CURR', 'B3-GBOX-VIB', 'B4-GBOX-TEMP'].some(id => getSensorStatus(id) === 'CRITICAL') ? (
                  <span className="status-badge critical">FAULT ACTIVE</span>
                ) : (
                  <span className="status-badge nominal">OPTIMAL</span>
                )}
              </div>
            </div>

            {/* SVG Visualizer for Conveyor Drive */}
            <div style={{ width: '100%', height: '260px', position: 'relative', background: 'radial-gradient(circle at center, rgba(168, 85, 247, 0.04) 0%, transparent 70%)', borderRadius: '8px' }}>
              <svg viewBox="0 0 600 280" style={{ width: '100%', height: '100%' }}>
                <defs>
                  <linearGradient id="gboxGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1e293b" />
                    <stop offset="100%" stopColor="#0f172a" />
                  </linearGradient>
                  <radialGradient id="heatGlowB" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor={getSensorStatus('B4-GBOX-TEMP') === 'CRITICAL' ? 'rgba(239,68,68,0.5)' : 'rgba(168,85,247,0.05)'} />
                    <stop offset="100%" stopColor="transparent" />
                  </radialGradient>
                </defs>

                {/* Gearbox Heat Glow */}
                <ellipse cx="230" cy="140" rx="80" ry="60" fill="url(#heatGlowB)" />

                {/* Ground Foundation */}
                <rect x="20" y="215" width="560" height="12" fill="#1e293b" stroke="#334155" strokeWidth="1" rx="3" />
                <line x1="20" y1="227" x2="580" y2="227" stroke="rgba(168, 85, 247, 0.3)" strokeDasharray="4 4" />

                {/* Conveyor Drive Motor (B1 Temp, B2 Current) */}
                <rect x="50" y="90" width="90" height="110" rx="8" fill="#1e293b" stroke="#a855f7" strokeWidth="1.5" />
                {[105, 120, 135, 150, 165, 180].map((y, idx) => (
                  <line key={idx} x1="58" y1={y} x2="132" y2={y} stroke="#334155" strokeWidth="1.5" />
                ))}

                {/* Motor Power Terminal */}
                <rect x="80" y="68" width="40" height="22" rx="3" fill="#0f172a" stroke="#c084fc" strokeWidth="1" />
                <text x="100" y="82" fill="#c084fc" fontSize="8" textAnchor="middle" fontFamily="var(--font-mono)">415V</text>

                {/* Helical Gearbox Housing (B3 Vib, B4 Oil Temp) */}
                <polygon points="160,110 270,80 300,150 260,200 160,200" fill="url(#gboxGrad)" stroke="#a855f7" strokeWidth="1.5" />

                {/* Intermeshing Gear Wheels in Gearbox */}
                <g transform="translate(200, 140)">
                  <g style={{
                    transformOrigin: 'center',
                    animation: isSensorInjected('B3-GBOX-VIB')
                      ? 'spinFast 0.5s linear infinite'
                      : 'spinSlow 2s linear infinite'
                  }}>
                    <circle cx="0" cy="0" r="28" fill="none" stroke="#64748b" strokeWidth="6" strokeDasharray="6 3" />
                    <circle cx="0" cy="0" r="10" fill="#a855f7" />
                  </g>
                </g>
                <g transform="translate(245, 130)">
                  <g style={{
                    transformOrigin: 'center',
                    animation: isSensorInjected('B3-GBOX-VIB')
                      ? 'spinFast 0.35s linear infinite reverse'
                      : 'spinSlow 1.4s linear infinite reverse'
                  }}>
                    <circle cx="0" cy="0" r="18" fill="none" stroke="#94a3b8" strokeWidth="5" strokeDasharray="5 2.5" />
                    <circle cx="0" cy="0" r="6" fill="#38bdf8" />
                  </g>
                </g>

                {/* Gearbox Oil Sump Reservoir Indicator */}
                <rect x="180" y="185" width="70" height="12" rx="2" fill="rgba(245, 158, 11, 0.2)" stroke="#f59e0b" strokeWidth="0.8" />
                <text x="215" y="194" fill="#fbbf24" fontSize="8" textAnchor="middle" fontFamily="var(--font-mono)">OIL SUMP</text>

                {/* Conveyor Drive Pulley & Belt Assembly */}
                <circle cx="340" cy="140" r="35" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
                <circle cx="530" cy="140" r="30" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
                
                {/* Rolling Belt */}
                <path d="M 340 105 L 530 110 A 30 30 0 0 1 530 170 L 340 175 A 35 35 0 0 1 340 105 Z" fill="none" stroke="#475569" strokeWidth="6" />
                <path d="M 340 105 L 530 110 A 30 30 0 0 1 530 170 L 340 175 A 35 35 0 0 1 340 105 Z" fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeDasharray="8 6" style={{ animation: 'conveyorMove 1s linear infinite' }} />

                {/* Cargo Boxes on Belt */}
                <rect x="390" y="85" width="28" height="24" rx="2" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" />
                <rect x="460" y="88" width="28" height="22" rx="2" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" />

                {/* ================= SENSOR OVERLAY NODES ================= */}
                {/* B1: Conveyor Motor Casing Temp */}
                <g 
                  onClick={() => { sound.playClick(); setSelectedSensor('B1-MOTOR-TEMP'); }} 
                  style={{ cursor: 'pointer' }}
                >
                  <circle cx="80" cy="140" r="13" fill="#0b1120" stroke={getStatusColor(getSensorStatus('B1-MOTOR-TEMP'))} strokeWidth="2.5" />
                  <circle cx="80" cy="140" r="5" fill={getStatusColor(getSensorStatus('B1-MOTOR-TEMP'))} />
                  <rect x="25" y="165" width="115" height="22" rx="4" fill="rgba(0,0,0,0.85)" stroke={getStatusColor(getSensorStatus('B1-MOTOR-TEMP'))} strokeWidth="1" />
                  <text x="82" y="180" fill="#fff" fontSize="10" textAnchor="middle" fontFamily="var(--font-mono)" fontWeight="700">
                    B1: {readings['B1-MOTOR-TEMP']?.value || '62.0'} °C
                  </text>
                </g>

                {/* B2: Conveyor Supply Current */}
                <g 
                  onClick={() => { sound.playClick(); setSelectedSensor('B2-MOTOR-CURR'); }} 
                  style={{ cursor: 'pointer' }}
                >
                  <circle cx="100" cy="68" r="12" fill="#0b1120" stroke={getStatusColor(getSensorStatus('B2-MOTOR-CURR'))} strokeWidth="2" />
                  <circle cx="100" cy="68" r="5" fill={getStatusColor(getSensorStatus('B2-MOTOR-CURR'))} />
                  <rect x="135" y="45" width="95" height="20" rx="4" fill="rgba(0,0,0,0.85)" stroke={getStatusColor(getSensorStatus('B2-MOTOR-CURR'))} strokeWidth="1" />
                  <text x="182" y="59" fill="#fff" fontSize="10" textAnchor="middle" fontFamily="var(--font-mono)" fontWeight="700">
                    B2: {readings['B2-MOTOR-CURR']?.value || '8.2'} A
                  </text>
                </g>

                {/* B3: Gearbox Housing Vibration */}
                <g 
                  onClick={() => { sound.playClick(); setSelectedSensor('B3-GBOX-VIB'); }} 
                  style={{ cursor: 'pointer' }}
                >
                  <circle cx="270" cy="115" r="13" fill="#0b1120" stroke={getStatusColor(getSensorStatus('B3-GBOX-VIB'))} strokeWidth="2.5" />
                  <circle cx="270" cy="115" r="5" fill={getStatusColor(getSensorStatus('B3-GBOX-VIB'))} />
                  <rect x="220" y="45" width="110" height="22" rx="4" fill="rgba(0,0,0,0.85)" stroke={getStatusColor(getSensorStatus('B3-GBOX-VIB'))} strokeWidth="1" />
                  <text x="275" y="60" fill="#fff" fontSize="10" textAnchor="middle" fontFamily="var(--font-mono)" fontWeight="700">
                    B3: {readings['B3-GBOX-VIB']?.value || '3.5'} mm/s
                  </text>
                </g>

                {/* B4: Gearbox Oil Temperature */}
                <g 
                  onClick={() => { sound.playClick(); setSelectedSensor('B4-GBOX-TEMP'); }} 
                  style={{ cursor: 'pointer' }}
                >
                  <circle cx="215" cy="180" r="13" fill="#0b1120" stroke={getStatusColor(getSensorStatus('B4-GBOX-TEMP'))} strokeWidth="2.5" />
                  <circle cx="215" cy="180" r="5" fill={getStatusColor(getSensorStatus('B4-GBOX-TEMP'))} />
                  <rect x="270" y="195" width="115" height="22" rx="4" fill="rgba(0,0,0,0.85)" stroke={getStatusColor(getSensorStatus('B4-GBOX-TEMP'))} strokeWidth="1" />
                  <text x="327" y="210" fill="#fff" fontSize="10" textAnchor="middle" fontFamily="var(--font-mono)" fontWeight="700">
                    B4: {readings['B4-GBOX-TEMP']?.value || '67.0'} °C
                  </text>
                </g>
              </svg>
            </div>

            {/* Quick Action Buttons for Machine B */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '12px' }}>
              {MACHINES['MACHINE-B'].sensors.map(s => {
                const isInjected = isSensorInjected(s.deviceId);
                const status = getSensorStatus(s.deviceId);
                return (
                  <div key={s.deviceId} style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{s.deviceId}</div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.name}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                      <span className="font-mono" style={{ fontSize: '0.75rem', fontWeight: 700, color: getStatusColor(status) }}>
                        {readings[s.deviceId]?.value} {s.unit}
                      </span>
                      <button
                        onClick={() => {
                          sound.playClick();
                          isInjected ? onClear(s.deviceId) : onInject(s.deviceId);
                        }}
                        className={`scada-btn ${isInjected ? 'scada-btn-danger' : ''}`}
                        style={{ padding: '3px 8px', fontSize: '0.65rem' }}
                      >
                        {isInjected ? 'Clear' : 'Inject'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
