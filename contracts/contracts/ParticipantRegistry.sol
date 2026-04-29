// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract ParticipantRegistry is AccessControl {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    enum ParticipantRole {
        NONE,
        FARMER,
        ADMIN,
        BUYER,
        CONSUMER,
        CERTIFIER
    }

    struct Participant {
        uint256 id;
        address account;
        ParticipantRole role;
        string name;
        string email;
        string metadataURI;
        bool requested;
        bool verified;
        uint256 createdAt;
        uint256 verifiedAt;
        string notes;
    }

    uint256 private _participantIds;
    mapping(address => Participant) private _participants;
    mapping(uint256 => address) public participantIdToAddress;

    event ParticipantRequested(
        uint256 indexed participantId,
        address indexed account,
        ParticipantRole role,
        string metadataURI
    );
    event ParticipantVerified(
        uint256 indexed participantId,
        address indexed account,
        ParticipantRole role,
        bool approved,
        string notes
    );
    event ParticipantMetadataUpdated(address indexed account, string metadataURI);

    constructor(address initialAdmin) {
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(VERIFIER_ROLE, initialAdmin);
    }

    function requestRegistration(
        ParticipantRole role,
        string calldata name,
        string calldata email,
        string calldata metadataURI
    ) external {
        require(role != ParticipantRole.NONE, "Invalid participant role");

        Participant storage participant = _participants[msg.sender];
        if (participant.id == 0) {
            _participantIds++;
            participant.id = _participantIds;
            participantIdToAddress[_participantIds] = msg.sender;
            participant.account = msg.sender;
            participant.createdAt = block.timestamp;
        }

        participant.role = role;
        participant.name = name;
        participant.email = email;
        participant.metadataURI = metadataURI;
        participant.requested = true;
        participant.verified = false;
        participant.verifiedAt = 0;
        participant.notes = "";

        emit ParticipantRequested(participant.id, msg.sender, role, metadataURI);
    }

    function verifyParticipant(
        address account,
        bool approved,
        string calldata notes
    ) external onlyRole(VERIFIER_ROLE) {
        Participant storage participant = _participants[account];
        require(participant.requested, "Participant has not requested registration");

        participant.verified = approved;
        participant.verifiedAt = approved ? block.timestamp : 0;
        participant.notes = notes;

        if (approved && participant.role == ParticipantRole.ADMIN) {
            _grantRole(VERIFIER_ROLE, account);
            _grantRole(DEFAULT_ADMIN_ROLE, account);
        }

        emit ParticipantVerified(participant.id, account, participant.role, approved, notes);
    }

    function updateMetadata(string calldata metadataURI) external {
        Participant storage participant = _participants[msg.sender];
        require(participant.requested, "Participant not found");
        participant.metadataURI = metadataURI;
        emit ParticipantMetadataUpdated(msg.sender, metadataURI);
    }

    function getParticipant(address account) external view returns (Participant memory) {
        return _participants[account];
    }

    function isVerifiedParticipant(address account) external view returns (bool) {
        return _participants[account].verified;
    }

    function isVerifiedRole(address account, uint8 role) external view returns (bool) {
        Participant storage participant = _participants[account];
        return participant.verified && uint8(participant.role) == role;
    }

    function getParticipantRole(address account) external view returns (uint8) {
        return uint8(_participants[account].role);
    }
}
