# AWS Free Tier Setup & 1-Click Cloud Deployment Guide

This guide walks you through setting up your **AWS Free Tier Account** and deploying the complete **Aether Plant SCADA** cloud infrastructure to **AWS Mumbai (`ap-south-1`)** using the provided 1-Click CloudFormation template.

---

## Part 1: Setting Up Your AWS Free Tier Account (5–10 Minutes)

### Step 1: Register Account
1. Open your browser and navigate to: **[https://aws.amazon.com/free/](https://aws.amazon.com/free/)**
2. Click **Create a Free Account**.
3. Enter your **Email address** and an **AWS account name** (e.g., `aether-plant-admin`).
4. Complete the email verification code sent to your inbox.
5. Create a strong root password.

### Step 2: Account Details & Identity Verification
1. Under **Contact Information**, choose **Personal** (for academic/individual projects).
2. Enter your name, phone number, and address.
3. On the **Billing Information** step, enter a valid debit or credit card:
   > **Note on Free Tier:** AWS will initiate a temporary verification charge of ~$1 USD (or ₹2 INR in India), which is **immediately reversed/refunded**. You will not be charged as long as you operate within the Free Tier limits.
4. Complete the phone SMS/Call verification.
5. On the **Select a Support Plan** screen, choose **Basic support - Free** (do not select Developer or Business).
6. Click **Complete sign up** and sign in to the **AWS Management Console**.

---

## Part 2: Security & Budget Guardrails (Phase 1 from Plan)

Before deploying any resources, activate these cost and security protections:

### 1. Select the Mumbai Region
In the top-right navigation bar of the AWS Console, click the region dropdown and select:  
👉 **Asia Pacific (Mumbai) `ap-south-1`**

### 2. Enable MFA on the Root User
1. Search for **IAM** in the top search bar.
2. Under **Security recommendations**, click **Add MFA**.
3. Choose **Authenticator app** (Google Authenticator, Microsoft Authenticator, or Authy).
4. Scan the QR code and enter two consecutive codes to activate.

### 3. Activate Free Tier Budget Alerts
1. In the search bar, search for **AWS Budgets**.
2. Click **Create budget**.
3. Choose **Zero spend budget** (or enter a threshold like $2.00).
4. Enter your email address to receive immediate alerts if any service exceeds free tier thresholds.
5. Click **Create budget**.

---

## Part 3: 1-Click CloudFormation Deployment

The template [`aws/plant-cloudformation.yaml`](file:///d:/Cloud_computing_project/aws/plant-cloudformation.yaml) deploys all tables, roles, S3 storage, SNS topics, Lambda code, IoT rules, and the EC2 dashboard server automatically.

### Step 1: Open CloudFormation
1. In the AWS Console, make sure you are in **ap-south-1 (Mumbai)**.
2. In the top search bar, search for **CloudFormation** and open the service.
3. Click the orange **Create stack** button (select *With new resources (standard)*).

### Step 2: Upload the Template
1. Under **Prerequisite - Prepare template**, select **Template is ready**.
2. Under **Template source**, select **Upload a template file**.
3. Click **Choose file** and select:  
   `d:\Cloud_computing_project\aws\plant-cloudformation.yaml`
4. Click **Next**.

### Step 3: Specify Stack Details
1. **Stack name**: `aether-plant-stack`
2. **AlertEmail**: Enter the email address where you want to receive critical machine fault alerts.
3. **ServicePassword**: Leave as `plant-admin-2026` (or set a custom password).
4. **SepoliaRpcUrl** & **ContractAddress**: Keep the defaults (or enter your Alchemy RPC URL).
5. Click **Next**.

### Step 4: Configure Stack Options & Submit
1. On the **Configure stack options** page, leave default settings and click **Next**.
2. Scroll to the bottom of the **Review** page.
3. Check the box:  
   ☑️ *I acknowledge that AWS CloudFormation might create IAM resources with custom names.*
4. Click **Submit**.

CloudFormation will now automatically provision all 18 infrastructure components in parallel. The status will transition from `CREATE_IN_PROGRESS` to **`CREATE_COMPLETE`** in approximately 2 to 3 minutes.

---

## Part 4: Confirm SNS Email Subscription

1. Check your email inbox (the address you entered in `AlertEmail`).
2. You will receive an email from `no-reply@sns.amazonaws.com` with the subject:  
   **AWS Notification - Subscription Confirmation**
3. Click the **Confirm subscription** link inside the email.
4. Your browser will display: *"Subscription confirmed!"*

---

## Part 5: View Outputs & Access the Cloud Dashboard

Once the CloudFormation stack status is **CREATE_COMPLETE**:
1. Click on the **Outputs** tab of `aether-plant-stack`.
2. You will see:
   - **`DashboardAccessUrl`**: The public URL (`http://<EC2-IP>:5173/`) to access the live SCADA cloud dashboard.
   - **`DynamoDBReadingsTable`**: `plant-readings`
   - **`DynamoDBFaultsTable`**: `plant-faults`
   - **`S3ReportsBucket`**: `plant-reports-<your-account-id>`
   - **`SNSTopicArn`**: `arn:aws:sns:ap-south-1:...:plant-fault-alerts`

---

## Part 6: Provision the 8 IoT Things (Phase 2)

To register the 8 IoT Things (`A1-MOTOR-TEMP` through `B4-GBOX-TEMP`) and download their X.509 certificates:
```bash
# 1. Install boto3
pip install boto3

# 2. Configure AWS credentials (or run within IAM user context)
# 3. Run the provisioning script:
python simulator/provision_iot_things.py
```
The script creates all 8 Things, generates X.509 client certificates, attaches `plant-device-policy`, and saves the credentials into `certs/`.

---

## Cost Basis & Safety Checklist

- **DynamoDB**: 20 RCU / 20 WCU provisioned (Always-Free limit is 25 RCU / 25 WCU). **$0.00**
- **Lambda**: Handlers run only on faults (Limit is 1,000,000 requests/month). **$0.00**
- **SNS**: Alert emails (Limit is 1,000 emails/month). **$0.00**
- **IoT Core**: 250,000 free messages per month for 12 months. **$0.00**
- **EC2**: Covered under the 750 hours/month `t3.micro` free tier. Stop the instance when not in use.
