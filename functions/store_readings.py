"""
Google Cloud Functions — Store All Readings
GCP Equivalent of AWS IoT Core Rule 1 (DynamoDBv2 action)
Runtime: Python 3.12

Triggered by every message on the 'plant-telemetry-store-readings' Pub/Sub subscription.
Writes the telemetry payload to Cloud Firestore 'plant-readings' collection with a TTL
field for automatic 7-day expiry (Cloud Firestore TTL policy applied via gcloud CLI).
"""

import base64
import json
import os
import time
import functions_framework
from google.cloud import firestore

READINGS_COLLECTION = os.environ.get("READINGS_COLLECTION", "plant-readings")
TTL_SECONDS = int(os.environ.get("TTL_SECONDS", str(7 * 24 * 3600)))  # 7 days

db = firestore.Client()


@functions_framework.cloud_event
def store_readings(cloud_event):
    """
    Decode Pub/Sub payload and write the telemetry reading to Firestore.
    Mirrors AWS IoT Core Rule 1:
      SELECT *, timestamp() AS ts, floor(timestamp()/1000) + 604800 AS expire_at
      FROM 'plant/+/+/telemetry'
      -> DynamoDBv2 plant-readings
    """
    raw = base64.b64decode(cloud_event.data["message"]["data"]).decode("utf-8")
    event = json.loads(raw)

    device_id = event.get("device_id")
    if not device_id:
        print(f"[SKIP] No device_id in payload: {event}")
        return

    now_ms   = int(time.time() * 1000)
    expire_at = int(time.time()) + TTL_SECONDS  # epoch seconds for Firestore TTL

    doc_id = f"{device_id}_{now_ms}"
    doc_data = {
        **event,
        "ts":        now_ms,
        "expire_at": expire_at,  # Firestore TTL policy targets this field
        "ingested_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    db.collection(READINGS_COLLECTION).document(doc_id).set(doc_data)
    print(f"[OK] Stored reading for {device_id} | ts={now_ms}")
