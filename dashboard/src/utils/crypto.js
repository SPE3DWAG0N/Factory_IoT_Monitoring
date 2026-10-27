// Cryptographic Utilities for SHA-256 and Keccak-256 report verification

export async function computeSHA256(data) {
  let buffer;
  if (typeof data === 'string') {
    buffer = new TextEncoder().encode(data);
  } else if (data instanceof ArrayBuffer) {
    buffer = data;
  } else if (data instanceof Uint8Array) {
    buffer = data.buffer;
  } else if (data instanceof Blob) {
    buffer = await data.arrayBuffer();
  } else {
    buffer = new TextEncoder().encode(JSON.stringify(data));
  }

  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Emulate Keccak-256 (for ReportId derivation from fault_id)
export async function computeReportId(faultId) {
  // Uses SHA-256 prefixed with 0x as standard 32-byte representation for browser simplicity
  // while adhering to the 32-byte hex bytes32 ABI requirement
  const buffer = new TextEncoder().encode(`REPORT-ID-${faultId}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Intentionally alters 1 byte in a file / buffer to test cryptographic mismatch
export function tamperBuffer(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer.slice(0));
  if (bytes.length > 50) {
    // Flip bits in a prominent section
    bytes[42] = bytes[42] ^ 0xFF;
  } else if (bytes.length > 0) {
    bytes[0] = bytes[0] ^ 0xFF;
  }
  return bytes.buffer;
}

export function formatAddress(addr) {
  if (!addr) return '';
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function formatTxHash(hash) {
  if (!hash) return '';
  if (hash.length < 16) return hash;
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}
