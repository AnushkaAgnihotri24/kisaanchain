// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IParticipantRegistry.sol";

contract FarmRegistration is AccessControl {
    uint8 private constant FARMER_ROLE = 1;

    struct Farm {
        uint256 id;
        address owner;
        string farmName;
        string location;
        string cropType;
        string geoCoordinates;
        uint256 areaHectares;
        string metadataURI;
        bool active;
        uint256 registeredAt;
    }

    uint256 private _farmIds;
    IParticipantRegistry public immutable participantRegistry;
    mapping(uint256 => Farm) private _farms;
    mapping(address => uint256[]) private _ownerFarmIds;

    event FarmRegistered(
        uint256 indexed farmId,
        address indexed owner,
        string farmName,
        string location,
        string cropType
    );

    constructor(address registryAddress, address initialAdmin) {
        participantRegistry = IParticipantRegistry(registryAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
    }

    function registerFarm(
        string calldata farmName,
        string calldata location,
        string calldata cropType,
        string calldata geoCoordinates,
        uint256 areaHectares,
        string calldata metadataURI
    ) external returns (uint256 farmId) {
        require(
            participantRegistry.isVerifiedRole(msg.sender, FARMER_ROLE),
            "Only verified farmers can register farms"
        );
        require(bytes(farmName).length > 0, "Farm name is required");

        _farmIds++;
        farmId = _farmIds;

        _farms[farmId] = Farm({
            id: farmId,
            owner: msg.sender,
            farmName: farmName,
            location: location,
            cropType: cropType,
            geoCoordinates: geoCoordinates,
            areaHectares: areaHectares,
            metadataURI: metadataURI,
            active: true,
            registeredAt: block.timestamp
        });

        _ownerFarmIds[msg.sender].push(farmId);

        emit FarmRegistered(farmId, msg.sender, farmName, location, cropType);
    }

    function getFarm(uint256 farmId) external view returns (Farm memory) {
        return _farms[farmId];
    }

    function getFarmIdsByOwner(address owner) external view returns (uint256[] memory) {
        return _ownerFarmIds[owner];
    }

    function isFarmOwner(uint256 farmId, address owner) external view returns (bool) {
        return _farms[farmId].owner == owner && _farms[farmId].active;
    }

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
        )
    {
        Farm storage farm = _farms[farmId];
        return (
            farm.farmName,
            farm.location,
            farm.cropType,
            farm.geoCoordinates,
            farm.areaHectares,
            farm.metadataURI,
            farm.owner,
            farm.active
        );
    }
}
