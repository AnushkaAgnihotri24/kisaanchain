// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITraceability {
    function recordAutomatedEvent(
        uint256 batchId,
        string calldata eventType,
        address actor,
        string calldata details,
        string calldata metadataURI
    ) external;
}
