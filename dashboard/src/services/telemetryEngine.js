// Real-time IoT Telemetry & AWS DynamoDB/Lambda Fault Engine
import { ALL_SENSORS, MACHINES, PLANT_CONFIG } from '../constants/plantConfig';
import { sound } from '../utils/sound';

const FAULTS_STORAGE_KEY = 'aether_dynamo_faults_v1';

export class TelemetryEngine {
  constructor() {
    this.intervalId = null;
    this.streamSpeed = 2500; // ms (smooth responsive SCADA experience)
    this.isRunning = true;
    this.listeners = new Set();
    this.injectedSensors = new Set(); // Devices with active injected faults

    // Initialize sensor states with baseline midpoint
    this.currentReadings = {};
    ALL_SENSORS.forEach(sensor => {
      const mid = (sensor.baselineMin + sensor.baselineMax) / 2;
      this.currentReadings[sensor.deviceId] = {
        deviceId: sensor.deviceId,
        machineId: sensor.machineId,
        part: sensor.part,
        sensorType: sensor.sensorType,
        value: Number(mid.toFixed(2)),
        unit: sensor.unit,
        limit: sensor.limit,
        status: 'NOMINAL',
        sentAt: new Date().toISOString(),
        history: []
      };
    });

    // Populate initial 20 historical readings per sensor so charts look rich immediately
    this.populateInitialHistory();

    // Fault state (simulating DynamoDB plant-faults table and ACTIVE markers)
    this.activeMarkers = new Set(); // device_ids with an open fault
    this.faults = this.loadFaults();

    // Active SNS Alert notification queue
    this.recentSNSAlert = null;

    this.startStream();
  }

  populateInitialHistory() {
    const now = Date.now();
    for (let i = 25; i >= 0; i--) {
      const t = new Date(now - i * this.streamSpeed).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      ALL_SENSORS.forEach(sensor => {
        const span = sensor.baselineMax - sensor.baselineMin;
        const val = Number((sensor.baselineMin + Math.random() * span).toFixed(2));
        this.currentReadings[sensor.deviceId].history.push({
          time: t,
          value: val
        });
      });
    }
  }

  loadFaults() {
    try {
      const stored = localStorage.getItem(FAULTS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.forEach(f => {
          if (f.status === 'OPEN') {
            this.activeMarkers.add(f.deviceId);
          }
        });
        return parsed;
      }
    } catch (e) {
      console.warn('Could not read faults from storage', e);
    }

    // Default seeded fault for immediate exploration
    const defaultFault = {
      faultId: 'F-1730019280000',
      deviceId: 'A3-MOTOR-VIB',
      machineId: 'MACHINE-A',
      part: 'motor_bearing_de',
      sensorType: 'vibration',
      triggerValue: 8.62,
      limit: 7.0,
      unit: 'mm/s',
      status: 'ANCHORED',
      createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      reportId: '0x7b8f9e1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      snsDispatched: true
    };
    return [defaultFault];
  }

  saveFaults() {
    try {
      localStorage.setItem(FAULTS_STORAGE_KEY, JSON.stringify(this.faults));
    } catch (e) {
      console.error('Failed to save faults:', e);
    }
  }

  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.getState());
    return () => this.listeners.delete(callback);
  }

  notify() {
    const state = this.getState();
    this.listeners.forEach(cb => {
      try {
        cb(state);
      } catch (err) {
        console.error('Telemetry subscriber error:', err);
      }
    });
  }

  getState() {
    return {
      readings: { ...this.currentReadings },
      faults: [...this.faults],
      activeMarkers: Array.from(this.activeMarkers),
      injectedSensors: Array.from(this.injectedSensors),
      recentSNSAlert: this.recentSNSAlert,
      isRunning: this.isRunning,
      streamSpeed: this.streamSpeed
    };
  }

  startStream() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => this.tick(), this.streamSpeed);
    this.isRunning = true;
    this.notify();
  }

  pauseStream() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
    this.isRunning = false;
    this.notify();
  }

  setSpeed(speedMs) {
    this.streamSpeed = speedMs;
    if (this.isRunning) {
      this.startStream();
    }
  }

  // Inject fault on a specific device (simulates CLI command: inject <device_id>)
  injectFault(deviceId) {
    this.injectedSensors.add(deviceId);
    const sensor = ALL_SENSORS.find(s => s.deviceId === deviceId);
    if (!sensor) return;

    // Immediately push reading above limit
    let spikeVal = sensor.limit + (sensor.sensorType === 'vibration' ? 1.8 : sensor.sensorType === 'current' ? 2.5 : 8.5);
    spikeVal = Number(spikeVal.toFixed(2));
    
    this.updateDeviceReading(deviceId, spikeVal);
    this.tick(); // Process limit checks immediately
  }

  // Clear fault on a device (simulates CLI command: clear <device_id>)
  clearFault(deviceId) {
    this.injectedSensors.delete(deviceId);
    const sensor = ALL_SENSORS.find(s => s.deviceId === deviceId);
    if (!sensor) return;

    // Restore to normal baseline
    const normalVal = Number(((sensor.baselineMin + sensor.baselineMax) / 2).toFixed(2));
    this.updateDeviceReading(deviceId, normalVal);
    this.notify();
  }

  clearAllInjections() {
    this.injectedSensors.clear();
    ALL_SENSORS.forEach(s => {
      const normalVal = Number(((s.baselineMin + s.baselineMax) / 2).toFixed(2));
      this.updateDeviceReading(s.deviceId, normalVal);
    });
    this.notify();
  }

  updateDeviceReading(deviceId, val) {
    const sensor = ALL_SENSORS.find(s => s.deviceId === deviceId);
    if (!sensor) return;
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const reading = this.currentReadings[deviceId];
    reading.value = val;
    reading.status = val > sensor.limit ? 'CRITICAL' : val > sensor.limit * 0.9 ? 'WARNING' : 'NOMINAL';
    reading.sentAt = new Date().toISOString();
    
    reading.history.push({ time: nowStr, value: val });
    if (reading.history.length > 60) {
      reading.history.shift();
    }
  }

  tick() {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    ALL_SENSORS.forEach(sensor => {
      const cur = this.currentReadings[sensor.deviceId];
      let nextVal;

      if (this.injectedSensors.has(sensor.deviceId)) {
        // Keep in spiked fault territory with slight jitter
        const jitter = (Math.random() - 0.5) * (sensor.sensorType === 'vibration' ? 0.3 : 0.8);
        const minSpike = sensor.limit + (sensor.sensorType === 'vibration' ? 1.2 : 2.0);
        nextVal = Math.max(minSpike, Number((cur.value + jitter).toFixed(2)));
      } else {
        // Bounded random walk inside normal operating range
        const step = (Math.random() - 0.49) * (sensor.sensorType === 'vibration' ? 0.15 : 0.4);
        let candidate = cur.value + step;
        
        // Soft bound to normal baseline
        if (candidate > sensor.baselineMax) candidate = sensor.baselineMax - Math.random() * 0.2;
        if (candidate < sensor.baselineMin) candidate = sensor.baselineMin + Math.random() * 0.2;
        nextVal = Number(candidate.toFixed(2));
      }

      cur.value = nextVal;
      cur.status = nextVal > sensor.limit ? 'CRITICAL' : nextVal > sensor.limit * 0.9 ? 'WARNING' : 'NOMINAL';
      cur.sentAt = new Date().toISOString();

      cur.history.push({ time: timeStr, value: nextVal });
      if (cur.history.length > 60) {
        cur.history.shift();
      }

      // AWS IoT Core Rule 2 & Lambda Evaluation
      if (nextVal > sensor.limit) {
        this.handleFaultDetection(sensor, nextVal);
      }
    });

    this.notify();
  }

  // AWS Lambda plant-fault-handler simulation
  handleFaultDetection(sensor, value) {
    // Condition check: attribute_not_exists (one open fault per device)
    // DynamoDB conditional write: attribute_not_exists(device_id) on ACTIVE_MARKER item
    if (this.activeMarkers.has(sensor.deviceId)) {
      // Open fault already active for this device. Suppress duplicate alert.
      return;
    }

    // Set ACTIVE marker (simulates DynamoDB ACTIVE_MARKER item)
    this.activeMarkers.add(sensor.deviceId);

    // Create Fault Item in DynamoDB (plant-faults table)
    const faultId = `F-${Date.now()}`;
    const newFault = {
      faultId,
      deviceId: sensor.deviceId,
      machineId: sensor.machineId,
      part: sensor.part,
      sensorType: sensor.sensorType,
      triggerValue: value,
      limit: sensor.limit,
      unit: sensor.unit,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      snsDispatched: true
    };

    this.faults.unshift(newFault);
    this.saveFaults();

    // Trigger Amazon SNS email notification (simulation)
    this.recentSNSAlert = {
      ...newFault,
      topic: PLANT_CONFIG.snsTopicArn || 'arn:aws:sns:ap-south-1:849204918231:plant-fault-alerts',
      timestamp: new Date().toISOString(),
      subject: `CRITICAL ALERT: Device Limit Exceeded [${sensor.deviceId}]`,
      body: `Amazon SNS Notification: Device ${sensor.deviceId} on ${sensor.machineId} (${sensor.part}) exceeded safety threshold. Observed: ${value} ${sensor.unit} (Limit: ${sensor.limit} ${sensor.unit}). Fault ID: ${faultId}.`
    };

    sound.playAlarm();
  }

  dismissSNSAlert() {
    this.recentSNSAlert = null;
    this.notify();
  }

  // Resolution through Service Desk: marks fault ANCHORED and releases active device lock
  resolveFault(faultId, reportId, txHash) {
    const fault = this.faults.find(f => f.faultId === faultId);
    if (!fault) return;

    fault.status = 'ANCHORED';
    fault.reportId = reportId;
    fault.txHash = txHash;
    fault.anchoredAt = new Date().toISOString();

    // Remove active marker so device can monitor normally
    this.activeMarkers.delete(fault.deviceId);
    this.injectedSensors.delete(fault.deviceId);

    // Restore device to baseline
    const sensor = ALL_SENSORS.find(s => s.deviceId === fault.deviceId);
    if (sensor) {
      const normalVal = Number(((sensor.baselineMin + sensor.baselineMax) / 2).toFixed(2));
      this.updateDeviceReading(sensor.deviceId, normalVal);
    }

    this.saveFaults();
    sound.playSuccess();
    this.notify();
  }

  resetAll() {
    this.injectedSensors.clear();
    this.activeMarkers.clear();
    this.recentSNSAlert = null;
    this.faults = this.loadFaults().filter(f => f.status === 'ANCHORED');
    this.saveFaults();
    ALL_SENSORS.forEach(s => {
      const normalVal = Number(((s.baselineMin + s.baselineMax) / 2).toFixed(2));
      this.updateDeviceReading(s.deviceId, normalVal);
    });
    this.notify();
  }
}

export const telemetryEngine = new TelemetryEngine();
