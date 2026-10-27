"""
Google Cloud Functions — Fault Handler
GCP Equivalent of AWS Lambda (plant-fault-handler)
Runtime: Python 3.12
Memory: 256 MB | Timeout: 60s

Triggered by Cloud Pub/Sub messages on the 'plant-telemetry-fault-check' subscription.
Replaces:
  - AWS Lambda plant-fault-handler
  - Amazon DynamoDB transact_write_items → Google Cloud Firestore transactions
  - Amazon SNS publish              → SendGrid Email API (or SMTP)

Fault thresholds (same as IoT Core Rule 2):
  temperature > 90 °C  |  vibration > 7 mm/s  |  current > 12 A
"""

import base64
import json
import os
import time
import smtplib
import ssl
import functions_framework
from email.mime.text import MIMEText
from google.cloud import firestore
from google.api_core.exceptions import AlreadyExists

# ─── Environment variables (set via Secret Manager / Cloud Functions env) ────
FAULTS_COLLECTION  = os.environ.get("FAULTS_COLLECTION",  "plant-faults")
READINGS_COLLECTION = os.environ.get("READINGS_COLLECTION", "plant-readings")
ALERT_EMAIL_TO     = os.environ.get("ALERT_EMAIL_TO",  "engineer@plant-iot.internal")
ALERT_EMAIL_FROM   = os.environ.get("ALERT_EMAIL_FROM", "alerts@plant-iot.internal")
SMTP_HOST          = os.environ.get("SMTP_HOST",        "smtp.gmail.com")
SMTP_PORT          = int(os.environ.get("SMTP_PORT",    "587"))
SMTP_USER          = os.environ.get("SMTP_USER",        "")
SMTP_PASS          = os.environ.get("SMTP_PASS",        "")

# Sensor limits (mirrors IoT Core Rule 2 WHERE clause)
LIMITS = {
    "temperature": 90.0,
    "vibration":    7.0,
    "current":     12.0,
}

# Initialise Firestore client (ADC picks up the Cloud Functions SA automatically)
db = firestore.Client()


@functions_framework.cloud_event
def fault_handler(cloud_event):
    """
    Entry point: triggered by a Pub/Sub CloudEvent on plant-telemetry-fault-check.
    Decodes the base64-encoded telemetry JSON, checks thresholds, and if a breach
    is detected runs a Firestore transaction to atomically record the fault + active
    marker (exact equivalent of the DynamoDB conditional transact_write_items).
    """
    # ── 1. Decode Pub/Sub payload ────────────────────────────────────────────
    raw = base64.b64decode(cloud_event.data["message"]["data"]).decode("utf-8")
    event = json.loads(raw)

    device_id   = event.get("device_id")
    machine_id  = event.get("machine_id",  "UNKNOWN-MACHINE")
    part        = event.get("part",        "general_assembly")
    sensor_type = event.get("sensor_type")
    value       = float(event.get("value", 0.0))
    unit        = event.get("unit",        "")

    if not device_id or not sensor_type:
        print(f"[SKIP] Missing device_id or sensor_type in payload: {event}")
        return

    # ── 2. Threshold gate (Rule 2 equivalent) ────────────────────────────────
    limit = LIMITS.get(sensor_type, 90.0)
    if value <= limit:
        # Message passed Rule 2 filter incorrectly — discard
        return

    # ── 3. Firestore atomic transaction ──────────────────────────────────────
    now_ms     = int(time.time() * 1000)
    fault_id   = f"F-{now_ms}"
    created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    # Document references
    fault_doc_ref   = db.collection(FAULTS_COLLECTION).document(f"{device_id}_{fault_id}")
    marker_doc_ref  = db.collection(FAULTS_COLLECTION).document(f"{device_id}_ACTIVE_MARKER")

    @firestore.transactional
    def _write_fault(transaction):
        """
        Transactionally write the fault item and the ACTIVE marker.
        The marker uses a get-then-set pattern to enforce attribute_not_exists
        semantics — equivalent to DynamoDB ConditionExpression.
        """
        marker_snapshot = marker_doc_ref.get(transaction=transaction)
        if marker_snapshot.exists:
            # Active fault already open for this device — suppress duplicate
            raise AlreadyExists(f"Active fault marker already exists for {device_id}")

        # Write fault record
        transaction.set(fault_doc_ref, {
            "device_id":   device_id,
            "fault_id":    fault_id,
            "machine_id":  machine_id,
            "part":        part,
            "sensor_type": sensor_type,
            "value":       value,
            "limit":       limit,
            "unit":        unit,
            "status":      "OPEN",
            "created_at":  created_at,
        })

        # Write ACTIVE marker (prevents duplicate alerts until fault is resolved)
        transaction.set(marker_doc_ref, {
            "device_id":       device_id,
            "fault_id":        "ACTIVE_MARKER",
            "active_fault_id": fault_id,
            "created_at":      created_at,
        })

    transaction = db.transaction()
    try:
        _write_fault(transaction)
        print(f"[OK] Recorded OPEN fault {fault_id} for device {device_id}")
    except AlreadyExists:
        print(f"[SKIP] Active fault already present for {device_id}. Suppressing duplicate alert.")
        return

    # ── 4. Email Alert (replaces Amazon SNS email subscription) ──────────────
    subject = f"CRITICAL LIMIT BREACH: [{device_id}] {part.upper()} on {machine_id}"
    body = (
        f"AETHER INDUSTRIAL PLANT - EMERGENCY TELEMETRY BREACH\n\n"
        f"Fault Identifier: {fault_id}\n"
        f"Machine:          {machine_id}\n"
        f"Device:           {device_id} ({part})\n"
        f"Metric:           {sensor_type.capitalize()}\n"
        f"Recorded Value:   {value} {unit}\n"
        f"Safety Limit:     {limit} {unit}\n"
        f"Incident Time:    {created_at} UTC\n\n"
        f"Status: An active fault lock has been registered in Cloud Firestore.\n"
        f"Next Action: Field engineers must upload a certified service report to\n"
        f"the Service Desk and anchor its SHA-256 digest on Ethereum Sepolia to clear this lock."
    )

    _send_email_alert(subject, body)

    return {"fault_id": fault_id, "status": "OPEN"}


def _send_email_alert(subject: str, body: str):
    """Send SMTP email alert (replaces Amazon SNS email delivery)."""
    if not SMTP_USER or not SMTP_PASS:
        print(f"[WARN] SMTP credentials not configured — email alert skipped.")
        print(f"[ALERT] Subject: {subject}")
        return

    try:
        msg = MIMEText(body)
        msg["Subject"] = subject[:100]
        msg["From"]    = ALERT_EMAIL_FROM
        msg["To"]      = ALERT_EMAIL_TO

        ctx = ssl.create_default_context()
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls(context=ctx)
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(ALERT_EMAIL_FROM, [ALERT_EMAIL_TO], msg.as_string())

        print(f"[OK] Alert email dispatched to {ALERT_EMAIL_TO}")
    except Exception as err:
        print(f"[WARN] Email alert failed: {err}")
