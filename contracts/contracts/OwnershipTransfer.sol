// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IParticipantRegistry.sol";
import "./interfaces/ITraceability.sol";

contract OwnershipTransfer is AccessControl {
    bytes32 public constant MODULE_ROLE = keccak256("MODULE_ROLE");

    struct TransferRecord {
        uint256 id;
        uint256 batchId;
        address from;
        address to;
        string details;
        uint256 timestamp;
    }

    uint256 private _transferIds;
    IParticipantRegistry public immutable participantRegistry;
    ITraceability public traceability;

    mapping(uint256 => address) private _currentOwners;
    mapping(uint256 => TransferRecord[]) private _transferHistory;

    event InitialOwnerRegistered(uint256 indexed batchId, address indexed owner);
    event OwnershipTransferred(
        uint256 indexed batchId,
        uint256 indexed transferId,
        address indexed from,
        address to,
        string details
    );

    constructor(address registryAddress, address initialAdmin) {
        participantRegistry = IParticipantRegistry(registryAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
    }

    function setTraceability(address traceabilityAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        traceability = ITraceability(traceabilityAddress);
    }

    function grantModule(address moduleAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(MODULE_ROLE, moduleAddress);
    }

    function registerInitialOwner(uint256 batchId, address initialOwner) external onlyRole(MODULE_ROLE) {
        require(_currentOwners[batchId] == address(0), "Initial owner already set");
        _currentOwners[batchId] = initialOwner;

        _transferIds++;
        _transferHistory[batchId].push(
            TransferRecord({
                id: _transferIds,
                batchId: batchId,
                from: address(0),
                to: initialOwner,
                details: "Initial ownership registered",
                timestamp: block.timestamp
            })
        );

        if (address(traceability) != address(0)) {
            traceability.recordAutomatedEvent(
                batchId,
                "OWNERSHIP_INIT",
                initialOwner,
                "Initial owner registered",
                ""
            );
        }

        emit InitialOwnerRegistered(batchId, initialOwner);
    }

    function transferBatchOwnership(
        uint256 batchId,
        address to,
        string calldata details
    ) external {
        address currentOwner = _currentOwners[batchId];
        require(currentOwner != address(0), "Batch ownership not initialized");
        require(currentOwner == msg.sender, "Only current owner can transfer");
        require(participantRegistry.isVerifiedParticipant(to), "Recipient must be verified");

        _transferIds++;
        _currentOwners[batchId] = to;
        _transferHistory[batchId].push(
            TransferRecord({
                id: _transferIds,
                batchId: batchId,
                from: msg.sender,
                to: to,
                details: details,
                timestamp: block.timestamp
            })
        );

        if (address(traceability) != address(0)) {
            traceability.recordAutomatedEvent(
                batchId,
                "OWNERSHIP_TRANSFER",
                msg.sender,
                details,
                ""
            );
        }

        emit OwnershipTransferred(batchId, _transferIds, msg.sender, to, details);
    }

    function ownerOfBatch(uint256 batchId) external view returns (address) {
        return _currentOwners[batchId];
    }

    function getTransferCount(uint256 batchId) external view returns (uint256) {
        return _transferHistory[batchId].length;
    }

    function getTransferAt(uint256 batchId, uint256 index) external view returns (TransferRecord memory) {
        return _transferHistory[batchId][index];
    }
}
