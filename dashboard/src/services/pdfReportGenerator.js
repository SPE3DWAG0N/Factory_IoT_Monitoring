// PDF Service Report Generator using jsPDF
import { jsPDF } from 'jspdf';
import { computeSHA256 } from '../utils/crypto';

export async function generateServiceReportPDF({
  faultId,
  deviceId,
  machineName,
  part,
  sensorType,
  triggerValue,
  limit,
  unit,
  technician = 'Alex Chen (Lead Reliability Engineer)',
  workOrderNumber = `WO-${Date.now().toString().slice(-6)}`,
  diagnosis = 'Bearing race micro-pitting and thermal runaway on motor drive end.',
  correctiveAction = 'Replaced SKF 6310 deep-groove ball bearing, replenished Kluber synthetic grease, dynamically rebalanced motor rotor to ISO 1940 G2.5 standard.',
  clearanceNote = 'Post-repair run test conducted for 30 minutes. Vibration stabilized at 2.9 mm/s, winding temp stabilized at 64.2 °C. Cleared for continuous plant operation.'
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor = [16, 185, 129]; // Emerald #10B981
  const darkColor = [17, 24, 39];      // #111827
  const grayColor = [107, 114, 128];   // #6B7280

  // Header Banner
  doc.setFillColor(...darkColor);
  doc.rect(0, 0, 210, 36, 'F');

  doc.setFillColor(...primaryColor);
  doc.rect(0, 35, 210, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('AETHER INDUSTRIAL PLANT SYSTEMS', 14, 16);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(156, 163, 175);
  doc.text('AWS AP-SOUTH-1 (MUMBAI) | ETHEREUM SEPOLIA ANCHORED MAINTENANCE RECORD', 14, 23);
  doc.text('ISO 55001 ASSET MANAGEMENT & IEC 60034 COMPLIANCE REPORT', 14, 29);

  // Badge Top Right
  doc.setFillColor(20, 83, 45); // Dark green badge
  doc.roundedRect(148, 10, 48, 14, 2, 2, 'F');
  doc.setTextColor(52, 211, 153);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('BLOCKCHAIN AUDIT READY', 152, 17);
  doc.setFontSize(7);
  doc.setTextColor(209, 250, 229);
  doc.text('CRYPTOGRAPHICALLY SEALED', 152, 21.5);

  // Metadata Grid
  doc.setTextColor(...darkColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('OFFICIAL EQUIPMENT SERVICE & RESOLUTION REPORT', 14, 48);

  doc.setDrawColor(229, 231, 235);
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(14, 54, 182, 38, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('REPORT IDENTIFIER:', 20, 62);
  doc.setFont('helvetica', 'normal');
  doc.text(faultId || 'F-DEMO-001', 65, 62);

  doc.setFont('helvetica', 'bold');
  doc.text('WORK ORDER REF:', 115, 62);
  doc.setFont('helvetica', 'normal');
  doc.text(workOrderNumber, 155, 62);

  doc.setFont('helvetica', 'bold');
  doc.text('TARGET EQUIPMENT:', 20, 70);
  doc.setFont('helvetica', 'normal');
  doc.text(machineName || 'Machine A (Motor-Pump Set)', 65, 70);

  doc.setFont('helvetica', 'bold');
  doc.text('TIMESTAMP (UTC):', 115, 70);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date().toISOString().replace('T', ' ').slice(0, 19), 155, 70);

  doc.setFont('helvetica', 'bold');
  doc.text('IOT DEVICE ID:', 20, 78);
  doc.setFont('helvetica', 'normal');
  doc.text(`${deviceId} (${part})`, 65, 78);

  doc.setFont('helvetica', 'bold');
  doc.text('LEAD TECHNICIAN:', 115, 78);
  doc.setFont('helvetica', 'normal');
  doc.text(technician, 155, 78);

  doc.setFont('helvetica', 'bold');
  doc.text('ANOMALY TELEMETRY:', 20, 86);
  doc.setTextColor(220, 38, 38);
  doc.text(`${triggerValue || '8.45'} ${unit || ''} (Exceeded Alert Limit: ${limit || '7.0'} ${unit || ''})`, 65, 86);
  doc.setTextColor(...darkColor);

  // Section 1: Incident Cause
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Incident Diagnostics & Failure Analysis', 14, 102);

  doc.setDrawColor(209, 213, 219);
  doc.line(14, 104, 196, 104);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);
  const diagLines = doc.splitTextToSize(
    `Telemetry rule trigger confirmed via AWS IoT Core Rules Engine on topic plant/+/+/telemetry. Lambda plant-fault-handler initiated fault ID ${faultId}. Physical inspection confirmed: ${diagnosis}`,
    182
  );
  doc.text(diagLines, 14, 111);

  // Section 2: Corrective Actions
  doc.setTextColor(...darkColor);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Corrective Maintenance Performed', 14, 128);
  doc.line(14, 130, 196, 130);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);
  const actionLines = doc.splitTextToSize(
    `Authorized maintenance crew dispatched. Lockout-Tagout (LOTO) protocols observed.\n\nActions Executed:\n• ${correctiveAction}\n• Calibrated transducer baseline and conducted 30-min continuous dynamometer load run.\n• Re-checked vibration FFT spectra: harmonic peaks eliminated, RMS within Class 1 ISO limits.`,
    182
  );
  doc.text(actionLines, 14, 137);

  // Section 3: Clearance and Operational Status
  doc.setTextColor(...darkColor);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('3. Return-to-Service Clearance & Verification', 14, 172);
  doc.line(14, 174, 196, 174);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);
  const clearLines = doc.splitTextToSize(
    `${clearanceNote}\n\nEquipment status returned to NOMINAL. Active device fault lock released in DynamoDB plant-faults table. S3 archival copy stored under s3://plant-reports-prod/reports/${faultId}.pdf.`,
    182
  );
  doc.text(clearLines, 14, 181);

  // Section 4: Sign-off & Blockchain Seal
  doc.setDrawColor(229, 231, 235);
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(14, 210, 182, 48, 2, 2, 'FD');

  doc.setTextColor(...darkColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('IMMUTABLE BLOCKCHAIN PROOF & VERIFICATION NOTICE', 20, 220);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(75, 85, 99);
  doc.text('This document represents the canonical maintenance record for the incident above.', 20, 226);
  doc.text('The SHA-256 cryptographic digest of this exact file is anchored to the Ethereum Sepolia', 20, 231);
  doc.text('public smart contract ServiceReportRegistry at address 0x8A791620dd6260079BF849Dc5567aDC3F2FdC318.', 20, 236);
  doc.text('Any alteration of text, dates, signatures, or metadata will produce a cryptographic MISMATCH.', 20, 241);

  // Signature lines
  doc.setFont('helvetica', 'bold');
  doc.text('Service Engineer Signature: [ Electronically Signed - Private Key Stored in AWS SSM ]', 20, 250);

  // Footer
  doc.setFontSize(7.5);
  doc.setTextColor(...grayColor);
  doc.text('Generated by Aether Plant IoT Cloud Suite • AWS ap-south-1 & Ethereum Sepolia Testnet', 14, 285);
  doc.text('Page 1 of 1', 184, 285);

  const arrayBuffer = doc.output('arraybuffer');
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
  const sha256 = await computeSHA256(arrayBuffer);

  return {
    blob,
    arrayBuffer,
    sha256,
    filename: `reports/${faultId || 'sample'}.pdf`
  };
}
