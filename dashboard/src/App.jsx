import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import CloudAlertBanner from './components/CloudAlertBanner';
import DigitalTwin from './components/DigitalTwin';
import SensorTile from './components/SensorTile';
import TelemetryChart from './components/TelemetryChart';
import FaultsView from './components/FaultsView';
import ServiceDesk from './components/ServiceDesk';
import VerifyPortal from './components/VerifyPortal';
import CloudPipeline from './components/CloudPipeline';
import ChaosControls from './components/ChaosControls';
import { telemetryEngine } from './services/telemetryEngine';
import { MACHINES } from './constants/plantConfig';

export default function App() {
  const [telemetryState, setTelemetryState] = useState(telemetryEngine.getState());
  const [activeTab, setActiveTab] = useState('twin');
  const [targetFaultId, setTargetFaultId] = useState(null);
  const [verifyReportId, setVerifyReportId] = useState(null);

  useEffect(() => {
    const unsubscribe = telemetryEngine.subscribe((newState) => {
      setTelemetryState(newState);
    });
    return () => unsubscribe();
  }, []);

  const handleNavigateToService = (faultId) => {
    setTargetFaultId(faultId);
    setActiveTab('service');
  };

  const handleNavigateToVerify = (reportId) => {
    setVerifyReportId(reportId);
    setActiveTab('verify');
  };

  const openFaultsCount = telemetryState.faults.filter(f => f.status === 'OPEN').length;

  return (
    <div className="app-container">
      
      {/* Top SCADA Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openFaultsCount={openFaultsCount}
        isRunning={telemetryState.isRunning}
        toggleStream={() => telemetryState.isRunning ? telemetryEngine.pauseStream() : telemetryEngine.startStream()}
        streamSpeed={telemetryState.streamSpeed}
        setStreamSpeed={(s) => telemetryEngine.setSpeed(s)}
      />

      {/* Floating Google Cloud Pub/Sub Alert Banner */}
      <CloudAlertBanner
        alert={telemetryState.recentAlert}
        onDismiss={() => telemetryEngine.dismissAlert()}
        onNavigateToService={handleNavigateToService}
      />

      {/* Quick Demo Chaos Injection Controls */}
      <ChaosControls
        injectedSensors={telemetryState.injectedSensors}
        onInject={(id) => telemetryEngine.injectFault(id)}
        onClearAll={() => telemetryEngine.clearAllInjections()}
        onResetDemo={() => telemetryEngine.resetAll()}
      />

      {/* Main Tab Content Views */}
      <main style={{ minHeight: '650px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* ================= TAB 1: LIVE SCADA & DIGITAL TWIN ================= */}
        {activeTab === 'twin' && (
          <>
            {/* Interactive Mechanical Digital Twin Schematics */}
            <DigitalTwin
              readings={telemetryState.readings}
              injectedSensors={telemetryState.injectedSensors}
              onInject={(id) => telemetryEngine.injectFault(id)}
              onClear={(id) => telemetryEngine.clearFault(id)}
            />

            {/* 8 Sensor Status Tiles Grouped by Machine */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Machine A Tiles */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span className="font-mono" style={{ fontSize: '0.75rem', color: '#38bdf8', letterSpacing: '0.08em' }}>
                    GROUP 1:
                  </span>
                  <h3 className="font-display" style={{ fontSize: '1rem', color: '#fff' }}>
                    Machine A: Motor-Pump Set (4 Sensors)
                  </h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                  {MACHINES['MACHINE-A'].sensors.map(sensor => (
                    <SensorTile
                      key={sensor.deviceId}
                      sensor={sensor}
                      reading={telemetryState.readings[sensor.deviceId]}
                      isInjected={telemetryState.injectedSensors.includes(sensor.deviceId)}
                      onInject={(id) => telemetryEngine.injectFault(id)}
                      onClear={(id) => telemetryEngine.clearFault(id)}
                    />
                  ))}
                </div>
              </div>

              {/* Machine B Tiles */}
              <div style={{ marginTop: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span className="font-mono" style={{ fontSize: '0.75rem', color: '#c084fc', letterSpacing: '0.08em' }}>
                    GROUP 2:
                  </span>
                  <h3 className="font-display" style={{ fontSize: '1rem', color: '#fff' }}>
                    Machine B: Conveyor Drive (4 Sensors)
                  </h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                  {MACHINES['MACHINE-B'].sensors.map(sensor => (
                    <SensorTile
                      key={sensor.deviceId}
                      sensor={sensor}
                      reading={telemetryState.readings[sensor.deviceId]}
                      isInjected={telemetryState.injectedSensors.includes(sensor.deviceId)}
                      onInject={(id) => telemetryEngine.injectFault(id)}
                      onClear={(id) => telemetryEngine.clearFault(id)}
                    />
                  ))}
                </div>
              </div>

            </div>

            {/* Real-time Multi-Sensor Telemetry Waveform */}
            <TelemetryChart readings={telemetryState.readings} />
          </>
        )}

        {/* ================= TAB 2: FAULT MANAGEMENT ================= */}
        {activeTab === 'faults' && (
          <FaultsView
            faults={telemetryState.faults}
            activeMarkers={telemetryState.activeMarkers}
            onNavigateToService={handleNavigateToService}
            onNavigateToVerify={handleNavigateToVerify}
          />
        )}

        {/* ================= TAB 3: SERVICE DESK ================= */}
        {activeTab === 'service' && (
          <ServiceDesk
            faults={telemetryState.faults}
            selectedFaultId={targetFaultId}
            onResolveFault={(faultId, reportId, txHash) => {
              telemetryEngine.resolveFault(faultId, reportId, txHash);
            }}
            onNavigateToVerify={handleNavigateToVerify}
          />
        )}

        {/* ================= TAB 4: PUBLIC VERIFIER ================= */}
        {activeTab === 'verify' && (
          <VerifyPortal prefilledReportId={verifyReportId} />
        )}

        {/* ================= TAB 5: ARCHITECTURE PIPELINE ================= */}
        {activeTab === 'pipeline' && (
          <CloudPipeline />
        )}

      </main>

      {/* Footer */}
      <footer style={{
        marginTop: '24px',
        padding: '16px 20px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        color: 'var(--text-dim)',
        fontSize: '0.75rem'
      }}>
        <div className="font-mono">
          Cloud IoT Monitoring with Blockchain-Verified Service Reports • GCP Mumbai (asia-south1) & Sepolia
        </div>
        <div className="font-mono" style={{ display: 'flex', gap: '16px' }}>
          <span>Firestore: Native Mode</span>
          <span>•</span>
          <span>Pub/Sub: Fan-Out Subscriptions</span>
          <span>•</span>
          <span>Solidity 0.8.x: 0 Gas Verify</span>
        </div>
      </footer>

    </div>
  );
}
