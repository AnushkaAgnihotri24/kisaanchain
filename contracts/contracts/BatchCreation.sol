// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IParticipantRegistry.sol";
import "./interfaces/IFarmRegistration.sol";
import "./interfaces/ITraceability.sol";
import "./interfaces/IOwnershipTransfer.sol";

contract BatchCreation is AccessControl {
    bytes32 public constant MODULE_ROLE = keccak256("MODULE_ROLE");
    uint8 private constant FARMER_ROLE = 1;

    enum BatchStatus {
        CREATED,
        CERTIFIED,
        PROCESSING,
        PACKAGED,
        IN_TRANSIT,
        DELIVERED,
        COMPLETED
    }

    struct Batch {
        uint256 id;
        string batchCode;
        uint256 farmId;
        address farmer;
        uint256 harvestDate;
        uint256 quantity;
        string unit;
        string metadataURI;
        BatchStatus status;
        uint256 createdAt;
        bool active;
    }

    uint256 private _batchIds;
    IParticipantRegistry public immutable participantRegistry;
    IFarmRegistration public immutable farmRegistration;
    ITraceability public traceability;
    IOwnershipTransfer public ownershipTransfer;

    mapping(uint256 => Batch) private _batches;
    mapping(address => uint256[]) private _farmerBatchIds;
    mapping(bytes32 => bool) private _batchCodes;

    event BatchCreated(
        uint256 indexed batchId,
        string indexed batchCode,
        uint256 indexed farmId,
        address farmer,
        uint256 quantity
    );
    event BatchStatusUpdated(uint256 indexed batchId, BatchStatus status);

    constructor(address registryAddress, address farmRegistrationAddress, address initialAdmin) {
        participantRegistry = IParticipantRegistry(registryAddress);
        farmRegistration = IFarmRegistration(farmRegistrationAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
    }

    function setLinkedContracts(
        address traceabilityAddress,
        address ownershipTransferAddress
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        traceability = ITraceability(traceabilityAddress);
        ownershipTransfer = IOwnershipTransfer(ownershipTransferAddress);
    }

    function grantModule(address moduleAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(MODULE_ROLE, moduleAddress);
    }

    function createBatch(
        string calldata batchCode,
        uint256 farmId,
        uint256 harvestDate,
        uint256 quantity,
        string calldata unit,
        string calldata metadataURI
    ) external returns (uint256 batchId) {
        require(
            participantRegistry.isVerifiedRole(msg.sender, FARMER_ROLE),
            "Only verified farmers can create batches"
        );
        require(farmRegistration.isFarmOwner(farmId, msg.sender), "Only owning farmer can use farm");
        require(bytes(batchCode).length > 0, "Batch code is required");
        require(quantity > 0, "Batch quantity must be greater than zero");

        bytes32 batchCodeHash = keccak256(bytes(batchCode));
        require(!_batchCodes[batchCodeHash], "Batch code already exists");
        _batchCodes[batchCodeHash] = true;

        _batchIds++;
        batchId = _batchIds;

        _batches[batchId] = Batch({
            id: batchId,
            batchCode: batchCode,
            farmId: farmId,
            farmer: msg.sender,
            harvestDate: harvestDate,
            quantity: quantity,
            unit: unit,
            metadataURI: metadataURI,
            status: BatchStatus.CREATED,
            createdAt: block.timestamp,
            active: true
        });

        _farmerBatchIds[msg.sender].push(batchId);

        if (address(ownershipTransfer) != address(0)) {
            ownershipTransfer.registerInitialOwner(batchId, msg.sender);
        }

        if (address(traceability) != address(0)) {
            traceability.recordAutomatedEvent(
                batchId,
                "BATCH_CREATED",
                msg.sender,
                batchCode,
                metadataURI
            );
        }

        emit BatchCreated(batchId, batchCode, farmId, msg.sender, quantity);
    }

    function updateBatchStatus(
        uint256 batchId,
        BatchStatus status
    ) external {
        require(
            msg.sender == _batches[batchId].farmer || hasRole(MODULE_ROLE, msg.sender),
            "Not authorized to update batch"
        );
        require(_batches[batchId].active, "Batch not found");

        _batches[batchId].status = status;

        emit BatchStatusUpdated(batchId, status);
    }

    function getBatch(uint256 batchId) external view returns (Batch memory) {
        return _batches[batchId];
    }

    function getFarmerBatchIds(address farmer) external view returns (uint256[] memory) {
        return _farmerBatchIds[farmer];
    }

    function batchExists(uint256 batchId) external view returns (bool) {
        return _batches[batchId].active;
    }

    function getBatchSummary(
        uint256 batchId
    )
        external
        view
        returns (
            string memory batchCode,
            uint256 farmId,
            address farmer,
            uint256 harvestDate,
            uint256 quantity,
            string memory unit,
            string memory metadataURI,
            uint8 status,
            bool active
        )
    {
        Batch storage batch = _batches[batchId];
        return (
            batch.batchCode,
            batch.farmId,
            batch.farmer,
            batch.harvestDate,
            batch.quantity,
            batch.unit,
            batch.metadataURI,
            uint8(batch.status),
            batch.active
        );
    }
}
