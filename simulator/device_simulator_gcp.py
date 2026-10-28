"""
Google Cloud IoT Device Simulator
GCP Equivalent of simulator/device_simulator.py

Replaces:
  - AWS IoT Device SDK v2 (awsiotsdk) + mTLS cert-based auth
    → Google Cloud Pub/Sub Python client + Service Account JSON key auth

Simulates 8 industrial IoT devices across 2 machines.
Publishes JSON telemetry to the 'plant-telemetry' Pub/Sub topic every 10s.

Usage:
  1. Set GOOGLE_APPLICATION_CREDENTIALS to your Service Account key JSON path.
  2. Set GCP_PROJECT_ID environment variable.
  3. python simulator/device_simulator_gcp.py

Console commands (same as before):
  inject <device_id>   — spike readings past safety limit
  clear  <device_id>   — restore nominal baseline
  status               — list active injections
  quit                 — stop simulation
"""

import os
import sys
import time
import json
import random
import threading
from datetime import datetime, timezone

# Google Cloud Pub/Sub client
try:
    from google.cloud import pubsub_v1
    HAS_GCP_SDK = True
except ImportError:
    HAS_GCP_SDK = False

# ── Configuration ─────────────────────────────────────────────────────────────
GCP_PROJECT_ID = os.environ.get("GCP_PROJECT_ID", "your-gcp-project-id")
TOPIC_ID       = os.environ.get("PUBSUB_TOPIC",   "plant-telemetry")

DEVICES = [
    # Machine A (Motor-Pump Set)
    {"device_id": "A1-MOTOR-TEMP", "machine_id": "MACHINE-A", "part": "motor_winding",     "sensor_type": "temperature", "unit": "°C",   "min": 58.0, "max": 74.0, "limit": 90.0},
    {"device_id": "A2-MOTOR-CURR", "machine_id": "MACHINE-A", "part": "motor_supply",      "sensor_type": "current",     "unit": "A",    "min": 7.2,  "max": 9.8,  "limit": 12.0},
    {"device_id": "A3-MOTOR-VIB",  "machine_id": "MACHINE-A", "part": "motor_bearing_de",  "sensor_type": "vibration",   "unit": "mm/s", "min": 2.1,  "max": 4.2,  "limit": 7.0},
    {"device_id": "A4-PUMP-VIB",   "machine_id": "MACHINE-A", "part": "pump_bearing",      "sensor_type": "vibration",   "unit": "mm/s", "min": 2.2,  "max": 4.4,  "limit": 7.0},
    # Machine B (Conveyor Drive)
    {"device_id": "B1-MOTOR-TEMP", "machine_id": "MACHINE-B", "part": "conveyor_motor_casing", "sensor_type": "temperature", "unit": "°C",   "min": 56.0, "max": 73.0, "limit": 90.0},
    {"device_id": "B2-MOTOR-CURR", "machine_id": "MACHINE-B", "part": "conveyor_supply",       "sensor_type": "current",     "unit": "A",    "min": 7.5,  "max": 9.9,  "limit": 12.0},
    {"device_id": "B3-GBOX-VIB",   "machine_id": "MACHINE-B", "part": "gearbox_housing",       "sensor_type": "vibration",   "unit": "mm/s", "min": 2.3,  "max": 4.5,  "limit": 7.0},
    {"device_id": "B4-GBOX-TEMP",  "machine_id": "MACHINE-B", "part": "gearbox_oil_sump",      "sensor_type": "temperature", "unit": "°C",   "min": 59.0, "max": 75.0, "limit": 90.0},
]

injected_faults: set = set()
running: bool        = True

# ── Pub/Sub publisher (batching for efficiency) ────────────────────────────────
publisher  = None
topic_path = None
if HAS_GCP_SDK and GCP_PROJECT_ID != "your-gcp-project-id":
    try:
        batch_settings = pubsub_v1.types.BatchSettings(
            max_messages=100,
            max_bytes=1_000_000,
            max_latency=0.01,
        )
        publisher  = pubsub_v1.PublisherClient(batch_settings=batch_settings)
        topic_path = publisher.topic_path(GCP_PROJECT_ID, TOPIC_ID)
    except Exception as err:
        print(f"[!] Pub/Sub initialization error: {err}. Falling back to dry-run mode.")
        publisher = None


def generate_reading(dev_config: dict) -> dict:
    """Bounded random walk inside nominal range; spikes above limit if injected."""
    dev_id = dev_config["device_id"]
    if dev_id in injected_faults:
        # Spiked reading past safety limit (same logic as original simulator)
        if dev_config["sensor_type"] == "vibration":
            val = round(dev_config["limit"] + random.uniform(1.2, 2.5), 2)
        elif dev_config["sensor_type"] == "current":
            val = round(dev_config["limit"] + random.uniform(1.8, 3.5), 2)
        else:
            val = round(dev_config["limit"] + random.uniform(4.0, 12.0), 2)
    else:
        val = round(random.uniform(dev_config["min"], dev_config["max"]), 2)

    return {
        "device_id":  dev_id,
        "machine_id": dev_config["machine_id"],
        "part":       dev_config["part"],
        "sensor_type": dev_config["sensor_type"],
        "value":      val,
        "unit":       dev_config["unit"],
        "sent_at":    datetime.now(timezone.utc).isoformat(),
    }


def publish_reading(payload: dict):
    """Publish a single telemetry payload to GCP Pub/Sub."""
    if not HAS_GCP_SDK or publisher is None:
        return  # Dry-run mode

    data = json.dumps(payload).encode("utf-8")
    # Pub/Sub message attributes mirror the MQTT topic structure
    attributes = {
        "machine_id":  payload["machine_id"],
        "device_id":   payload["device_id"],
        "sensor_type": payload["sensor_type"],
    }
    future = publisher.publish(topic_path, data=data, **attributes)
    return future  # Non-blocking; futures are resolved by the batch flush


def simulation_loop(interval_sec: int = 10):
    global running
    mode_str = f"Live Pub/Sub -> projects/{GCP_PROJECT_ID}/topics/{TOPIC_ID}" if (HAS_GCP_SDK and publisher) else "Local Simulation (Dry-Run Mode)"
    print(f"[*] Starting telemetry stream (publishing every {interval_sec}s for 8 devices)")
    print(f"[*] Operational Mode: {mode_str}")
    print("[*] Available console commands: 'inject <device_id>', 'clear <device_id>', 'status', 'quit'")

    while running:
        futures = []
        for dev in DEVICES:
            payload    = generate_reading(dev)
            status_tag = "[ALERT CRITICAL]" if dev["device_id"] in injected_faults else "[NOMINAL]"
            print(f"[{datetime.now().strftime('%H:%M:%S')}] {status_tag} {dev['machine_id']}/{dev['device_id']} -> {payload['value']} {payload['unit']}")
            fut = publish_reading(payload)
            if fut:
                futures.append(fut)

        # Wait for all publishes to confirm
        for fut in futures:
            try:
                fut.result(timeout=5)
            except Exception as e:
                print(f"[WARN] Pub/Sub publish error: {e}")

        time.sleep(interval_sec)


def cli_listener():
    global running
    while running:
        try:
            line  = input().strip()
            if not line:
                continue
            parts = line.split()
            cmd   = parts[0].lower()

            if cmd in ("quit", "exit"):
                print("[*] Stopping simulation...")
                running = False
                break
            elif cmd == "inject" and len(parts) > 1:
                target = parts[1].upper()
                if any(d["device_id"] == target for d in DEVICES):
                    injected_faults.add(target)
                    print(f"[!] INJECTED FAULT ON: {target} (Value will spike past safety threshold)")
                else:
                    print(f"[-] Unknown device ID: {target}")
            elif cmd == "clear" and len(parts) > 1:
                target = parts[1].upper()
                injected_faults.discard(target)
                print(f"[+] RESTORED NOMINAL BASELINE FOR: {target}")
            elif cmd == "status":
                print(f"[*] Injected Anomalies: {list(injected_faults) or 'None (All Nominal)'}")
            else:
                print("[-] Commands: inject <device_id>, clear <device_id>, status, quit")
        except EOFError:
            break


if __name__ == "__main__":
    if not HAS_GCP_SDK:
        print("[!] google-cloud-pubsub not installed. Running in local dry-run simulation mode.")
        print("[*] To publish to live GCP Pub/Sub: pip install google-cloud-pubsub")
    elif GCP_PROJECT_ID == "your-gcp-project-id":
        print("[!] WARNING: Set GCP_PROJECT_ID environment variable before running in production.")
        print("[*] Example: set GCP_PROJECT_ID=my-project-id  (Windows) or export GCP_PROJECT_ID=... (Linux/Mac)")

    t = threading.Thread(target=simulation_loop, args=(10,), daemon=True)
    t.start()
    cli_listener()
