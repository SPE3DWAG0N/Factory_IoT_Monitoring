"""
AWS IoT Core Device Provisioning Script (Phase 2)
Provisions the 8 IoT Things, X.509 certificates, and plant-device-policy.
Outputs certificates into the git-ignored certs/ folder.
"""

import os
import sys
import json

DEVICES = [
    "A1-MOTOR-TEMP", "A2-MOTOR-CURR", "A3-MOTOR-VIB", "A4-PUMP-VIB",
    "B1-MOTOR-TEMP", "B2-MOTOR-CURR", "B3-GBOX-VIB", "B4-GBOX-TEMP"
]

POLICY_NAME = "plant-device-policy"
REGION = os.environ.get("AWS_REGION", "ap-southeast-2")

DEVICE_POLICY_DOCUMENT = {
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "iot:Connect",
            "Resource": f"arn:aws:iot:{REGION}:*:client/${{iot:Connection.Thing.ThingName}}"
        },
        {
            "Effect": "Allow",
            "Action": "iot:Publish",
            "Resource": f"arn:aws:iot:{REGION}:*:topic/plant/*/${{iot:Connection.Thing.ThingName}}/telemetry"
        }
    ]
}

def provision():
    try:
        import boto3
    except ImportError:
        print("[-] boto3 is not installed. Run: pip install boto3")
        sys.exit(1)

    iot = boto3.client("iot", region_name=REGION)
    certs_dir = os.path.join(os.path.dirname(__file__), "..", "certs")
    os.makedirs(certs_dir, exist_ok=True)

    print(f"[*] Ensuring IoT Policy '{POLICY_NAME}' exists...")
    try:
        iot.create_policy(
            policyName=POLICY_NAME,
            policyDocument=json.dumps(DEVICE_POLICY_DOCUMENT)
        )
        print(f"[+] Created policy: {POLICY_NAME}")
    except iot.exceptions.ResourceAlreadyExistsException:
        print(f"[*] Policy {POLICY_NAME} already exists.")

    for thing_name in DEVICES:
        print(f"\n[*] Provisioning Thing: {thing_name}...")
        
        # 1. Create Thing
        try:
            iot.create_thing(thingName=thing_name)
            print(f"[+] Created Thing: {thing_name}")
        except iot.exceptions.ResourceAlreadyExistsException:
            print(f"[*] Thing {thing_name} already exists.")

        # 2. Create Keys and Certificate
        cert_resp = iot.create_keys_and_certificate(setAsActive=True)
        cert_arn = cert_resp["certificateArn"]
        cert_id = cert_resp["certificateId"]

        # Save cert files
        cert_path = os.path.join(certs_dir, f"{thing_name}.cert.pem")
        key_path = os.path.join(certs_dir, f"{thing_name}.private.key")
        with open(cert_path, "w") as f:
            f.write(cert_resp["certificatePem"])
        with open(key_path, "w") as f:
            f.write(cert_resp["keyPair"]["PrivateKey"])

        # 3. Attach Policy to Certificate
        iot.attach_policy(policyName=POLICY_NAME, target=cert_arn)

        # 4. Attach Certificate to Thing
        iot.attach_thing_principal(thingName=thing_name, principal=cert_arn)
        print(f"[+] Attached active certificate {cert_id[:10]}... to {thing_name}")

    print("\n[✔] Successfully provisioned all 8 IoT Things in AWS IoT Core (ap-south-1)!")
    print(f"[*] Certificates and private keys stored safely in: {certs_dir}")

if __name__ == "__main__":
    provision()
