// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IFarmRegistration {
    function isFarmOwner(uint256 farmId, address owner) external view returns (bool);

    function getFarmSummary(
        uint256 farmId
    )
        external
        view
        returns (
            string memory farmName,
            string memory location,
            string memory cropType,
            string memory geoCoordinates,
            uint256 areaHectares,
            string memory metadataURI,
            address owner,
            bool active
        );
}
