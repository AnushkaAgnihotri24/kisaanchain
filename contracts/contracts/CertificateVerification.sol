// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IBatchCreation.sol";
import "./interfaces/IParticipantRegistry.sol";
import "./interfaces/ITraceability.sol";

contract CertificateVerification is AccessControl {
    uint8 private constant CERTIFIER_ROLE = 5;

    struct Certificate {
        uint256 id;
        uint256 batchId;
        string certificateType;
        string documentCID;
        string metadataURI;
        address issuer;
        bool verified;
        uint256 createdAt;
        uint256 verifiedAt;
    }

    uint256 private _certificateIds;
    IBatchCreation public immutable batchCreation;
    IParticipantRegistry public immutable participantRegistry;
    ITraceability public traceability;

    mapping(uint256 => Certificate[]) private _batchCertificates;

    event CertificateAdded(
        uint256 indexed certificateId,
        uint256 indexed batchId,
        string certificateType,
        address issuer
    );
    event CertificateVerified(
        uint256 indexed certificateId,
        uint256 indexed batchId,
        address verifier
    );

    constructor(
        address batchCreationAddress,
        address registryAddress,
        address traceabilityAddress,
        address initialAdmin
    ) {
        batchCreation = IBatchCreation(batchCreationAddress);
        participantRegistry = IParticipantRegistry(registryAddress);
        traceability = ITraceability(traceabilityAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
    }

    function addCertificate(
        uint256 batchId,
        string calldata certificateType,
        string calldata documentCID,
        string calldata metadataURI
    ) external returns (uint256 certificateId) {
        require(batchCreation.batchExists(batchId), "Batch does not exist");
        require(participantRegistry.isVerifiedParticipant(msg.sender), "Only verified participant");

        _certificateIds++;
        certificateId = _certificateIds;

        _batchCertificates[batchId].push(
            Certificate({
                id: certificateId,
                batchId: batchId,
                certificateType: certificateType,
                documentCID: documentCID,
                metadataURI: metadataURI,
                issuer: msg.sender,
                verified: false,
                createdAt: block.timestamp,
                verifiedAt: 0
            })
        );

        traceability.recordAutomatedEvent(
            batchId,
            "CERTIFICATE_UPLOADED",
            msg.sender,
            certificateType,
            documentCID
        );

        emit CertificateAdded(certificateId, batchId, certificateType, msg.sender);
    }

    function verifyCertificate(
        uint256 batchId,
        uint256 index
    ) external {
        require(
            participantRegistry.isVerifiedRole(msg.sender, CERTIFIER_ROLE) ||
                hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Only certifier or admin"
        );
        Certificate storage certificate = _batchCertificates[batchId][index];
        certificate.verified = true;
        certificate.verifiedAt = block.timestamp;

        traceability.recordAutomatedEvent(
            batchId,
            "CERTIFICATE_VERIFIED",
            msg.sender,
            certificate.certificateType,
            certificate.documentCID
        );

        emit CertificateVerified(certificate.id, batchId, msg.sender);
    }

    function getCertificateCount(uint256 batchId) external view returns (uint256) {
        return _batchCertificates[batchId].length;
    }

    function getCertificateAt(
        uint256 batchId,
        uint256 index
    ) external view returns (Certificate memory) {
        return _batchCertificates[batchId][index];
    }

    function getVerifiedCertificateCount(uint256 batchId) external view returns (uint256 count) {
        uint256 length = _batchCertificates[batchId].length;
        for (uint256 index = 0; index < length; index++) {
            if (_batchCertificates[batchId][index].verified) {
                count++;
            }
        }
    }
}
