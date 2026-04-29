// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBatchCreation {
    function batchExists(uint256 batchId) external view returns (bool);

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
        );
}
