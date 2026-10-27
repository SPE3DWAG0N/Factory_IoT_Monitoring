import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Cpu, 
  ShieldAlert, 
  Wrench, 
  CheckCircle2, 
  Network, 
  Volume2, 
  VolumeX, 
  Play, 
  Pause, 
  Download,
  Laptop,
  Monitor
} from 'lucide-react';
import { PLANT_CONFIG } from '../constants/plantConfig';
import { sound } from '../utils/sound';

export default function Header({ 
  activeTab, 
  setActiveTab, 
  openFaultsCount, 
  isRunning, 
  toggleStream, 
  streamSpeed, 
  setStreamSpeed 
}) {
  const [timeStr, setTimeStr] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(sound.enabled);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toUTCString().slice(17, 25) + ' UTC');
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Check if running in standalone App mode
    const checkStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    setIsStandalone(checkStandalone);

    // Listen for PWA installation event
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleSoundToggle = () => {
    const state = sound.toggle();
    setSoundEnabled(state);
    if (state) sound.playClick();
  };

  const handleInstallClick = async () => {
    sound.playClick();
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        sound.playSuccess();
        setDeferredPrompt(null);
      }
    } else {
      setShowInstallModal(true);
    }
  };

  const navItems = [
    { id: 'twin', label: 'Live SCADA & Twin', icon: Activity },
    { 
      id: 'faults', 
      label: 'Fault Management', 
      icon: ShieldAlert, 
      badge: openFaultsCount > 0 ? openFaultsCount : null,
      badgeType: 'critical' 
    },
    { id: 'service', label: 'Service Desk', icon: Wrench },
    { id: 'verify', label: 'Public Verifier', icon: CheckCircle2 },
    { id: 'pipeline', label: 'Cloud Architecture', icon: Network },
  ];

  return (
    <header className="scada-panel" style={{ padding: '16px 24px', marginBottom: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Brand & System Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(168, 85, 247, 0.2))',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(6, 182, 212, 0.25)'
          }}>
            <Cpu size={24} color="#22d3ee" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span className="font-display" style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '0.05em', color: '#fff' }}>
                AETHER<span style={{ color: '#22d3ee' }}>-PLANT</span> SCADA
              </span>
              <span className="status-badge nominal" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
                <span className="status-dot nominal" style={{ width: '6px', height: '6px' }} />
                v2.4 ONLINE
              </span>
              {isStandalone ? (
                <span className="status-badge anchored" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
                  <Laptop size={11} /> DESKTOP APP
                </span>
              ) : (
                <span className="font-mono" style={{ fontSize: '0.65rem', color: '#38bdf8', background: 'rgba(56,189,248,0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(56,189,248,0.2)' }}>
                  BROWSER & NATIVE APP
                </span>
              )}
            </div>
            <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '12px' }}>
              <span>GCP {PLANT_CONFIG.region} (Mumbai)</span>
              <span>•</span>
              <span style={{ color: '#c084fc' }}>Sepolia Testnet (11155111)</span>
              <span>•</span>
              <span style={{ color: '#38bdf8' }}>{timeStr}</span>
            </div>
          </div>
        </div>

        {/* Real-time Stream Controls, Install App & Sound */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          
          {/* Install as Native App Button */}
          {!isStandalone && (
            <button
              onClick={handleInstallClick}
              className="scada-btn scada-btn-blockchain"
              style={{
                padding: '6px 12px',
                fontSize: '0.75rem',
                height: '34px',
                gap: '6px'
              }}
              title="Install as standalone Native Desktop / Mobile App"
            >
              <Download size={14} />
              <span>Install Desktop App</span>
            </button>
          )}

          {/* Feed Controls */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(0,0,0,0.4)',
            padding: '4px 10px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.06)'
          }}>
            <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>FEED:</span>
            <button 
              onClick={toggleStream} 
              className="scada-btn" 
              style={{ padding: '4px 8px', fontSize: '0.75rem', height: '28px' }}
              title={isRunning ? 'Pause Telemetry Feed' : 'Resume Telemetry Feed'}
            >
              {isRunning ? <Pause size={14} color="#f59e0b" /> : <Play size={14} color="#10b981" />}
              <span>{isRunning ? 'LIVE' : 'PAUSED'}</span>
            </button>

            <select 
              value={streamSpeed} 
              onChange={(e) => setStreamSpeed(Number(e.target.value))}
              className="font-mono"
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '0.72rem',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value={1000}>Speed: 1.0s (Fast)</option>
              <option value={2500}>Speed: 2.5s (Demo)</option>
              <option value={5000}>Speed: 5.0s (Plan)</option>
              <option value={10000}>Speed: 10s (MQTT)</option>
            </select>
          </div>

          <button 
            onClick={handleSoundToggle} 
            className="scada-btn" 
            style={{ padding: '6px 10px', height: '36px' }}
            title={soundEnabled ? 'Mute SCADA Synthesizer' : 'Enable SCADA Synthesizer'}
          >
            {soundEnabled ? <Volume2 size={16} color="#34d399" /> : <VolumeX size={16} color="#9ca3af" />}
          </button>
        </div>

      </div>

      {/* Navigation Tabs */}
      <nav style={{
        display: 'flex',
        gap: '8px',
        marginTop: '16px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        paddingTop: '14px',
        overflowX: 'auto'
      }}>
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                sound.playClick();
                setActiveTab(item.id);
              }}
              className="scada-btn"
              style={{
                background: isActive 
                  ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.25), rgba(14, 116, 144, 0.35))' 
                  : 'rgba(255,255,255,0.03)',
                borderColor: isActive ? 'rgba(34, 211, 238, 0.6)' : 'rgba(255,255,255,0.06)',
                color: isActive ? '#fff' : 'var(--text-muted)',
                boxShadow: isActive ? '0 0 12px rgba(6, 182, 212, 0.2)' : 'none',
                position: 'relative',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={16} color={isActive ? '#22d3ee' : '#9ca3af'} />
              <span>{item.label}</span>
              {item.badge && (
                <span style={{
                  background: 'var(--color-critical)',
                  color: '#fff',
                  borderRadius: '9999px',
                  padding: '1px 6px',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  marginLeft: '4px',
                  animation: 'pulseCritical 1.5s infinite'
                }}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Install App Guide Modal if browser doesn't trigger prompt automatically */}
      {showInstallModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }} onClick={() => setShowInstallModal(false)}>
          <div style={{
            background: 'var(--bg-panel)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            borderRadius: '14px',
            padding: '24px',
            maxWidth: '520px',
            width: '100%',
            boxShadow: '0 0 35px rgba(6, 182, 212, 0.3)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <Monitor size={22} color="#38bdf8" />
              <h3 className="font-display" style={{ fontSize: '1.2rem', color: '#fff' }}>
                STANDALONE APP INSTALLATION
              </h3>
            </div>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              This system supports dual execution: as a standard <strong>Browser Web Application</strong> and as an <strong>Installed Desktop Application</strong>:
            </p>

            <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '8px', padding: '14px', margin: '14px 0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '0.82rem', color: '#e5e7eb' }}>
                <strong style={{ color: '#38bdf8' }}>Option A: Install via Browser (PWA)</strong><br />
                In Chrome / Edge, click the <strong>Install Icon (⊞)</strong> in the URL address bar or select <em>Settings &gt; Apps &gt; Install Aether SCADA</em>. It creates a desktop shortcut and opens in a dedicated window!
              </div>
              <div style={{ fontSize: '0.82rem', color: '#e5e7eb' }}>
                <strong style={{ color: '#c084fc' }}>Option B: Run as Electron Native Desktop App</strong><br />
                Run <code style={{ color: '#22d3ee', background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: '4px' }}>npm run desktop</code> from the terminal. It launches a dedicated native Windows executable window with full desktop features.
              </div>
            </div>

            <button
              onClick={() => setShowInstallModal(false)}
              className="scada-btn scada-btn-primary"
              style={{ width: '100%', padding: '10px' }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

    </header>
  );
}
