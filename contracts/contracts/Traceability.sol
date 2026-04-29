// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IParticipantRegistry.sol";

contract Traceability is AccessControl {
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");

    struct TraceEvent {
        uint256 id;
        uint256 batchId;
        string eventType;
        address actor;
        string details;
        string metadataURI;
        uint256 timestamp;
    }

    uint256 private _traceEventIds;
    IParticipantRegistry public immutable participantRegistry;
    mapping(uint256 => TraceEvent[]) private _batchEvents;

    event TraceabilityEventRecorded(
        uint256 indexed batchId,
        uint256 indexed traceEventId,
        string eventType,
        address actor,
        string details
    );

    constructor(address registryAddress, address initialAdmin) {
        participantRegistry = IParticipantRegistry(registryAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
    }

    function grantRecorder(address recorder) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(RECORDER_ROLE, recorder);
    }

    function recordAutomatedEvent(
        uint256 batchId,
        string calldata eventType,
        address actor,
        string calldata details,
        string calldata metadataURI
    ) external onlyRole(RECORDER_ROLE) {
        _appendEvent(batchId, eventType, actor, details, metadataURI);
    }

    function recordManualEvent(
        uint256 batchId,
        string calldata eventType,
        string calldata details,
        string calldata metadataURI
    ) external {
        require(participantRegistry.isVerifiedParticipant(msg.sender), "Only verified participants");
        _appendEvent(batchId, eventType, msg.sender, details, metadataURI);
    }

    function getEventCount(uint256 batchId) external view returns (uint256) {
        return _batchEvents[batchId].length;
    }

    function getEventAt(
        uint256 batchId,
        uint256 index
    ) external view returns (TraceEvent memory) {
        return _batchEvents[batchId][index];
    }

    function _appendEvent(
        uint256 batchId,
        string calldata eventType,
        address actor,
        string calldata details,
        string calldata metadataURI
    ) private {
        _traceEventIds++;
        TraceEvent memory traceEvent = TraceEvent({
            id: _traceEventIds,
            batchId: batchId,
            eventType: eventType,
            actor: actor,
            details: details,
            metadataURI: metadataURI,
            timestamp: block.timestamp
        });

        _batchEvents[batchId].push(traceEvent);

        emit TraceabilityEventRecorded(batchId, _traceEventIds, eventType, actor, details);
    }
}
