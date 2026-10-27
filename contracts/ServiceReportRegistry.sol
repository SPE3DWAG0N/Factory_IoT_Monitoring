// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ServiceReportRegistry
 * @dev Cryptographic anchoring registry for industrial IoT equipment service reports.
 * Complies with specification in iot_plan.pdf:
 *  - storeHash(reportId, fileHash): owner only, immutable (rejects duplicate ID).
 *  - verify(reportId, fileHash): read-only view function returning true/false with 0 gas cost.
 *  - Emits ReportStored event on every store.
 *  - Raw PDF files never go on-chain; only 32-byte digests.
 */
contract ServiceReportRegistry {
    address public owner;

    // Mapping from reportId (keccak256 of fault_id) to fileHash (SHA-256 of PDF)
    mapping(bytes32 => bytes32) private _registry;

    // Mapping to track registration timestamp
    mapping(bytes32 => uint256) public anchoredAt;

    event ReportStored(bytes32 indexed reportId, bytes32 fileHash, uint256 timestamp);

    error Unauthorized();
    error ReportAlreadyExists(bytes32 reportId);
    error InvalidHash();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Store a service report's SHA-256 digest on-chain.
     * @param reportId Keccak-256 hash of the fault ID (bytes32).
     * @param fileHash SHA-256 digest of the PDF service report (bytes32).
     */
    function storeHash(bytes32 reportId, bytes32 fileHash) external onlyOwner {
        if (reportId == bytes32(0) || fileHash == bytes32(0)) revert InvalidHash();
        if (_registry[reportId] != bytes32(0)) revert ReportAlreadyExists(reportId);

        _registry[reportId] = fileHash;
        anchoredAt[reportId] = block.timestamp;

        emit ReportStored(reportId, fileHash, block.timestamp);
    }

    /**
     * @notice Verify whether a submitted file SHA-256 hash matches the on-chain recorded hash.
     * @param reportId Keccak-256 hash of the fault ID.
     * @param fileHash SHA-256 digest of the candidate PDF file.
     * @return bool True if exact match, false otherwise.
     */
    function verify(bytes32 reportId, bytes32 fileHash) external view returns (bool) {
        bytes32 stored = _registry[reportId];
        if (stored == bytes32(0)) return false;
        return (stored == fileHash);
    }

    /**
     * @notice Retrieve stored file hash for a given reportId.
     */
    function getStoredHash(bytes32 reportId) external view returns (bytes32) {
        return _registry[reportId];
    }
}
