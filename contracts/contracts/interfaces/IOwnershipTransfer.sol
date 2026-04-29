// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IOwnershipTransfer {
    function registerInitialOwner(uint256 batchId, address initialOwner) external;

    function ownerOfBatch(uint256 batchId) external view returns (address);
}
