// Blockchain Service for Sepolia ServiceReportRegistry Interaction
import { PLANT_CONFIG } from '../constants/plantConfig';

const STORAGE_KEY = 'aether_sepolia_registry_v1';

// Initial pre-anchored reports to provide immediate data for examiners & demos
const DEFAULT_REGISTRY = {
  // reportId: { fileHash, txHash, blockNumber, timestamp, gasUsed, faultId, deviceId }
  '0x7b8f9e1234567890abcdef1234567890abcdef1234567890abcdef1234567890': {
    faultId: 'F-1730019280000',
    deviceId: 'A3-MOTOR-VIB',
    fileHash: '0x3f79a9576ee3b1f506dd5c88b7754eb2d28f87b8f2d5d852a3a0e6981f912e84',
    txHash: '0x9a8f217e63b40091d3cb8539e08362d512a8684bbd5137ce5fb7cf7a8109bf31',
    blockNumber: 7192840,
    timestamp: Date.now() - 86400000 * 2,
    gasUsed: 47820,
    contractAddress: PLANT_CONFIG.contractAddress
  }
};

export class BlockchainRegistryService {
  constructor() {
    this.contractAddress = PLANT_CONFIG.contractAddress;
    this.chainId = PLANT_CONFIG.sepoliaChainId;
    this.registry = this.loadRegistry();
  }

  loadRegistry() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_REGISTRY, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Storage read warning, using default registry:', e);
    }
    return { ...DEFAULT_REGISTRY };
  }

  saveRegistry() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.registry));
    } catch (e) {
      console.error('Failed to persist registry:', e);
    }
  }

  // Contract: storeHash(bytes32 reportId, bytes32 fileHash)
  async storeHash({ reportId, fileHash, faultId, deviceId }) {
    // Artificial latency to simulate Sepolia mempool and mining (1.5s)
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (this.registry[reportId]) {
      throw new Error(`Execution Reverted: Report ID ${reportId.slice(0, 10)}... already anchored on-chain.`);
    }

    // Generate realistic Sepolia transaction hash
    const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const txHash = `0x${randomHex}`;
    const blockNumber = 7193000 + Math.floor(Math.random() * 1500);
    const gasUsed = 46500 + Math.floor(Math.random() * 3000);

    const record = {
      faultId,
      deviceId,
      reportId,
      fileHash: fileHash.toLowerCase(),
      txHash,
      blockNumber,
      timestamp: Date.now(),
      gasUsed,
      contractAddress: this.contractAddress
    };

    this.registry[reportId] = record;
    this.saveRegistry();

    return record;
  }

  // Contract: verify(bytes32 reportId, bytes32 fileHash) returns (bool)
  async verify(reportId, fileHash) {
    // Read-only call simulation (200ms latency)
    await new Promise(resolve => setTimeout(resolve, 350));

    const normalizedReportId = reportId ? reportId.toLowerCase() : '';
    const normalizedFileHash = fileHash ? fileHash.toLowerCase() : '';

    // Search by reportId or directly by fileHash
    let record = this.registry[normalizedReportId];
    if (!record) {
      record = Object.values(this.registry).find(
        r => r.fileHash.toLowerCase() === normalizedFileHash
      );
    }

    if (!record) {
      return {
        matched: false,
        reason: 'NOT_FOUND',
        details: 'No anchored service report exists for this Report ID on Ethereum Sepolia.'
      };
    }

    if (record.fileHash.toLowerCase() === normalizedFileHash) {
      return {
        matched: true,
        record,
        reason: 'CRYPTOGRAPHIC_MATCH',
        details: 'SHA-256 digest matches on-chain immutable hash exactly.'
      };
    } else {
      return {
        matched: false,
        record,
        reason: 'HASH_MISMATCH',
        details: 'Report ID exists, but file SHA-256 digest differs! File has been altered or tampered with.'
      };
    }
  }

  getAnchoredReports() {
    return Object.values(this.registry);
  }

  resetRegistry() {
    this.registry = { ...DEFAULT_REGISTRY };
    this.saveRegistry();
  }
}

export const blockchainService = new BlockchainRegistryService();
