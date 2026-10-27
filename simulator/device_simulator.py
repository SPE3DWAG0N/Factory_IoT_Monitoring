"""
AWS IoT Device Simulator
Runtime: Python 3.12
SDK: AWS IoT Device SDK v2 for Python (awsiotsdk)

Simulates 8 industrial IoT Things across 2 machines:
- Machine A: Motor-Pump Set (A1-MOTOR-TEMP, A2-MOTOR-CURR, A3-MOTOR-VIB, A4-PUMP-VIB)
- Machine B: Conveyor Drive (B1-MOTOR-TEMP, B2-MOTOR-CURR, B3-GBOX-VIB, B4-GBOX-TEMP)

Modes:
1. Real AWS IoT Core mTLS Mode:
   Automatically activated when 'awsiotsdk' is installed and certificates exist in certs/
   (or AWS_IOT_ENDPOINT is set). Telemetry is published over MQTT with TLS v1.3.
2. Local Mock Stream Mode:
   Runs in-memory simulation with bounded random walk when AWS credentials or certs are absent.

Console CLI:
- 'inject <device_id>' — Force metric past safety limit
- 'clear <device_id>'  — Restore nominal baseline
- 'status'             — Show active anomalies
- 'quit' or 'exit'     — Stop simulator
"""

import os
import sys
import time
import json
import random
import threading
from datetime import datetime, timezone

# Optional awsiotsdk import; falls back gracefully for mock testing
try:
    from awsiot import mqtt_connection_builder
    from awscrt import mqtt
    HAS_AWS_SDK = True
except ImportError:
    HAS_AWS_SDK = False

DEVICES = [
    # Machine A (Motor-Pump Set)
    {"device_id": "A1-MOTOR-TEMP", "machine_id": "MACHINE-A", "part": "motor_winding", "sensor_type": "temperature", "unit": "°C", "min": 58.0, "max": 74.0, "limit": 90.0},
    {"device_id": "A2-MOTOR-CURR", "machine_id": "MACHINE-A", "part": "motor_supply", "sensor_type": "current", "unit": "A", "min": 7.2, "max": 9.8, "limit": 12.0},
    {"device_id": "A3-MOTOR-VIB", "machine_id": "MACHINE-A", "part": "motor_bearing_de", "sensor_type": "vibration", "unit": "mm/s", "min": 2.1, "max": 4.2, "limit": 7.0},
    {"device_id": "A4-PUMP-VIB", "machine_id": "MACHINE-A", "part": "pump_bearing", "sensor_type": "vibration", "unit": "mm/s", "min": 2.2, "max": 4.4, "limit": 7.0},
    
    # Machine B (Conveyor Drive)
    {"device_id": "B1-MOTOR-TEMP", "machine_id": "MACHINE-B", "part": "conveyor_motor_casing", "sensor_type": "temperature", "unit": "°C", "min": 56.0, "max": 73.0, "limit": 90.0},
    {"device_id": "B2-MOTOR-CURR", "machine_id": "MACHINE-B", "part": "conveyor_supply", "sensor_type": "current", "unit": "A", "min": 7.5, "max": 9.9, "limit": 12.0},
    {"device_id": "B3-GBOX-VIB", "machine_id": "MACHINE-B", "part": "gearbox_housing", "sensor_type": "vibration", "unit": "mm/s", "min": 2.3, "max": 4.5, "limit": 7.0},
    {"device_id": "B4-GBOX-TEMP", "machine_id": "MACHINE-B", "part": "gearbox_oil_sump", "sensor_type": "temperature", "unit": "°C", "min": 59.0, "max": 75.0, "limit": 90.0},
]

injected_faults = set()
running = True
mqtt_connections = {}

def get_iot_endpoint():
    endpoint = os.environ.get("AWS_IOT_ENDPOINT")
    if endpoint:
        return endpoint.strip()
    
    certs_dir = os.path.join(os.path.dirname(__file__), "..", "certs")
    endpoint_file = os.path.join(certs_dir, "endpoint.txt")
    if os.path.exists(endpoint_file):
        try:
            with open(endpoint_file, "r") as f:
                return f.read().strip()
        except Exception:
            pass
    return None

def init_mqtt_connection(thing_name, endpoint):
    if not HAS_AWS_SDK or not endpoint:
        return None
    
    certs_dir = os.path.join(os.path.dirname(__file__), "..", "certs")
    cert_path = os.path.join(certs_dir, f"{thing_name}.cert.pem")
    key_path = os.path.join(certs_dir, f"{thing_name}.private.key")
    root_ca = os.path.join(certs_dir, "AmazonRootCA1.pem")

    if not (os.path.exists(cert_path) and os.path.exists(key_path)):
        return None

    try:
        connection = mqtt_connection_builder.mtls_from_path(
            endpoint=endpoint,
            cert_filepath=cert_path,
            pri_key_filepath=key_path,
            ca_filepath=root_ca if os.path.exists(root_ca) else None,
            client_id=f"sim-{thing_name}-{int(time.time())}",
            clean_session=False,
            keep_alive_secs=30
        )
        connect_future = connection.connect()
        connect_future.result(timeout=10)
        return connection
    except Exception as e:
        print(f"[!] Warning: Could not connect {thing_name} to AWS IoT Core: {e}")
        return None

def setup_cloud_connections():
    global mqtt_connections
    endpoint = get_iot_endpoint()
    if not endpoint:
        print("[*] Note: AWS_IOT_ENDPOINT not found. Running in Local Mock Stream mode.")
        print("    To publish to real AWS IoT Core:")
        print("    1. Run: python simulator/provision_iot_things.py")
        print("    2. Re-run: python simulator/device_simulator.py\n")
        return

    if not HAS_AWS_SDK:
        print("[!] awsiotsdk not installed. Run: pip install awsiotsdk")
        print("[*] Running in Local Mock Stream mode.\n")
        return

    print(f"[*] Connecting 8 IoT Things to AWS IoT Core endpoint: {endpoint}...")
    for dev in DEVICES:
        thing_id = dev["device_id"]
        conn = init_mqtt_connection(thing_id, endpoint)
        if conn:
            mqtt_connections[thing_id] = conn
            print(f"  [✓] Connected {thing_id} via mTLS X.509")
        else:
            print(f"  [-] Using local mock stream for {thing_id}")

def generate_reading(dev_config):
    dev_id = dev_config["device_id"]
    if dev_id in injected_faults:
        # Spiked reading past safety limit
        if dev_config["sensor_type"] == "vibration":
            val = round(dev_config["limit"] + random.uniform(1.2, 2.5), 2)
        elif dev_config["sensor_type"] == "current":
            val = round(dev_config["limit"] + random.uniform(1.8, 3.5), 2)
        else:
            val = round(dev_config["limit"] + random.uniform(4.0, 12.0), 2)
    else:
        # Bounded random walk inside normal tolerances
        val = round(random.uniform(dev_config["min"], dev_config["max"]), 2)

    payload = {
        "device_id": dev_id,
        "machine_id": dev_config["machine_id"],
        "part": dev_config["part"],
        "sensor_type": dev_config["sensor_type"],
        "value": val,
        "unit": dev_config["unit"],
        "sent_at": datetime.now(timezone.utc).isoformat()
    }
    return payload

def simulation_loop(interval_sec=10):
    global running
    print(f"[*] Starting IoT telemetry stream (Publishing every {interval_sec}s for 8 devices)...")
    print("[*] Console commands: 'inject <device_id>', 'clear <device_id>', 'status', 'quit'")
    
    while running:
        for dev in DEVICES:
            dev_id = dev["device_id"]
            payload = generate_reading(dev)
            topic = f"plant/{dev['machine_id']}/{dev_id}/telemetry"
            status_tag = "[ALERT CRITICAL]" if dev_id in injected_faults else "[NOMINAL]"
            
            # Publish to real AWS IoT Core MQTT if connected
            conn = mqtt_connections.get(dev_id)
            if conn:
                try:
                    payload_json = json.dumps(payload)
                    conn.publish(
                        topic=topic,
                        payload=payload_json,
                        qos=mqtt.QoS.AT_LEAST_ONCE
                    )
                    mode_tag = "AWS-MQTT"
                except Exception as e:
                    mode_tag = f"ERR:{e}"
            else:
                mode_tag = "MOCK"

            print(f"[{datetime.now().strftime('%H:%M:%S')}] [{mode_tag}] {status_tag} {topic} -> {payload['value']} {payload['unit']}")
        time.sleep(interval_sec)

def cli_listener():
    global running
    while running:
        try:
            line = input().strip()
            if not line:
                continue
            parts = line.split()
            cmd = parts[0].lower()

            if cmd == "quit" or cmd == "exit":
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
                print(f"[*] Active AWS mTLS Connections: {len(mqtt_connections)}/8")
            else:
                print("[-] Commands: inject <device_id>, clear <device_id>, status, quit")
        except EOFError:
            break

if __name__ == "__main__":
    setup_cloud_connections()
    t = threading.Thread(target=simulation_loop, args=(10,), daemon=True)
    t.start()
    cli_listener()
