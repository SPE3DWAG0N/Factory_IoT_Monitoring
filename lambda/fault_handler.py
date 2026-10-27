"""
AWS Lambda Fault Handler (plant-fault-handler)
Runtime: Python 3.12
Memory: 128 MB | Timeout: 10s

Handles Rule 2 limit breaches from AWS IoT Core Rules Engine.
Uses DynamoDB conditional transactions to enforce exactly one open fault
per device and prevents duplicate SNS alert spam.
"""

import json
import os
import time
import boto3
from botocore.exceptions import ClientError

# Environment variables
FAULTS_TABLE = os.environ.get("FAULTS_TABLE", "plant-faults")
TOPIC_ARN = os.environ.get("TOPIC_ARN")

dynamodb = boto3.client("dynamodb")
sns = boto3.client("sns")

def lambda_handler(event, context):
    """
    Input event format from IoT Core Rule 2:
    {
        "device_id": "A1-MOTOR-TEMP",
        "machine_id": "MACHINE-A",
        "part": "motor_winding",
        "sensor_type": "temperature",
        "value": 94.2,
        "unit": "°C",
        "sent_at": "2026-10-25T13:00:00Z",
        "ts": 1792934000000
    }
    """
    device_id = event.get("device_id")
    machine_id = event.get("machine_id", "UNKNOWN-MACHINE")
    part = event.get("part", "general_assembly")
    sensor_type = event.get("sensor_type")
    value = float(event.get("value", 0.0))
    unit = event.get("unit", "")
    
    # Establish limit based on sensor type
    limits = {"temperature": 90.0, "vibration": 7.0, "current": 12.0}
    limit = limits.get(sensor_type, 90.0)

    now_ms = int(time.time() * 1000)
    fault_id = f"F-{now_ms}"
    created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    # DynamoDB transaction: Write fault item + ACTIVE marker item
    # Conditional check on ACTIVE marker prevents duplicate alerts
    transaction_items = [
        # 1. Fault Record
        {
            "Put": {
                "TableName": FAULTS_TABLE,
                "Item": {
                    "device_id": {"S": device_id},
                    "fault_id": {"S": fault_id},
                    "machine_id": {"S": machine_id},
                    "part": {"S": part},
                    "sensor_type": {"S": sensor_type},
                    "value": {"N": str(value)},
                    "limit": {"N": str(limit)},
                    "unit": {"S": unit},
                    "status": {"S": "OPEN"},
                    "created_at": {"S": created_at}
                }
            }
        },
        # 2. ACTIVE marker for device (enforces uniqueness of OPEN faults)
        {
            "Put": {
                "TableName": FAULTS_TABLE,
                "Item": {
                    "device_id": {"S": device_id},
                    "fault_id": {"S": "ACTIVE_MARKER"},
                    "active_fault_id": {"S": fault_id},
                    "created_at": {"S": created_at}
                },
                "ConditionExpression": "attribute_not_exists(device_id)"
            }
        }
    ]

    try:
        dynamodb.transact_write_items(TransactItems=transaction_items)
        print(f"Successfully recorded OPEN fault {fault_id} for device {device_id}")
    except ClientError as e:
        if e.response["Error"]["Code"] == "TransactionCanceledException":
            # Active fault marker already exists. Suppress duplicate alert.
            print(f"Active fault already present for device {device_id}. Suppressing alert.")
            return {
                "statusCode": 200,
                "body": json.dumps({"status": "SKIPPED_DUPLICATE_OPEN_FAULT", "device_id": device_id})
            }
        else:
            print(f"DynamoDB transaction error: {str(e)}")
            raise e

    # Publish Amazon SNS Email Alert
    subject = f"CRITICAL LIMIT BREACH: [{device_id}] {part.upper()} on {machine_id}"
    message = (
        f"AETHER INDUSTRIAL PLANT - EMERGENCY TELEMETRY BREACH\n\n"
        f"Fault Identifier: {fault_id}\n"
        f"Machine:          {machine_id}\n"
        f"Device:           {device_id} ({part})\n"
        f"Metric:           {sensor_type.capitalize()}\n"
        f"Recorded Value:   {value} {unit}\n"
        f"Safety Limit:     {limit} {unit}\n"
        f"Incident Time:    {created_at} UTC\n\n"
        f"Status: An active fault lock has been registered in Amazon DynamoDB.\n"
        f"Next Action: Field engineers must upload a certified service report to\n"
        f"the Service Desk and anchor its SHA-256 digest on Ethereum Sepolia to clear this lock."
    )

    try:
        if TOPIC_ARN:
            sns.publish(
                TopicArn=TOPIC_ARN,
                Subject=subject[:100],
                Message=message
            )
            print(f"Dispatched Amazon SNS alert email to {TOPIC_ARN}")
        else:
            print("TOPIC_ARN environment variable not set; skipping SNS dispatch.")
    except Exception as e:
        print(f"SNS Publish Warning: {str(e)}")

    return {
        "statusCode": 200,
        "body": json.dumps({
            "status": "FAULT_RECORDED",
            "fault_id": fault_id,
            "device_id": device_id
        })
    }
