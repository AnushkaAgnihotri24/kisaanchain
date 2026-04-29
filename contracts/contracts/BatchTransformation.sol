// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IBatchCreation.sol";
import "./interfaces/IOwnershipTransfer.sol";
import "./interfaces/ITraceability.sol";
import "./interfaces/IParticipantRegistry.sol";

contract BatchTransformation is AccessControl {
    struct Transformation {
        uint256 id;
        uint256 batchId;
        string transformationType;
        string details;
        string metadataURI;
        address actor;
        uint256 timestamp;
    }

    uint256 private _transformationIds;
    IBatchCreation public immutable batchCreation;
    IOwnershipTransfer public immutable ownershipTransfer;
    ITraceability public traceability;
    IParticipantRegistry public immutable participantRegistry;

    mapping(uint256 => Transformation[]) private _transformations;

    event BatchTransformed(
        uint256 indexed batchId,
        uint256 indexed transformationId,
        string transformationType,
        address actor
    );

    constructor(
        address batchCreationAddress,
        address ownershipTransferAddress,
        address traceabilityAddress,
        address registryAddress,
        address initialAdmin
    ) {
        require(batchCreationAddress != address(0), "BatchCreation address is required");
        require(ownershipTransferAddress != address(0), "OwnershipTransfer address is required");
        require(traceabilityAddress != address(0), "Traceability address is required");
        require(registryAddress != address(0), "Registry address is required");
        require(initialAdmin != address(0), "Admin address is required");

        batchCreation = IBatchCreation(batchCreationAddress);
        ownershipTransfer = IOwnershipTransfer(ownershipTransferAddress);
        traceability = ITraceability(traceabilityAddress);
        participantRegistry = IParticipantRegistry(registryAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
    }

    function recordTransformation(
        uint256 batchId,
        string calldata transformationType,
        string calldata details,
        string calldata metadataURI
    ) external {
        require(batchCreation.batchExists(batchId), "Batch does not exist");
        require(participantRegistry.isVerifiedParticipant(msg.sender), "Only verified participant");
        require(bytes(transformationType).length > 0, "Transformation type is required");
        require(bytes(details).length > 0, "Transformation details are required");

        address currentOwner = ownershipTransfer.ownerOfBatch(batchId);
        require(currentOwner == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Only owner or admin");

        _transformationIds++;
        _transformations[batchId].push(
            Transformation({
                id: _transformationIds,
                batchId: batchId,
                transformationType: transformationType,
                details: details,
                metadataURI: metadataURI,
                actor: msg.sender,
                timestamp: block.timestamp
            })
        );

        traceability.recordAutomatedEvent(
            batchId,
            transformationType,
            msg.sender,
            details,
            metadataURI
        );

        emit BatchTransformed(batchId, _transformationIds, transformationType, msg.sender);
    }

    function getTransformationCount(uint256 batchId) external view returns (uint256) {
        return _transformations[batchId].length;
    }

    function getTransformationAt(
        uint256 batchId,
        uint256 index
    ) external view returns (Transformation memory) {
        return _transformations[batchId][index];
    }
}
