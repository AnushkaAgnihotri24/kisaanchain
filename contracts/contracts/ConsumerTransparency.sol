// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IBatchCreation.sol";
import "./interfaces/IFarmRegistration.sol";
import "./interfaces/IOwnershipTransfer.sol";
import "./CertificateVerification.sol";
import "./Traceability.sol";

contract ConsumerTransparency {
    IBatchCreation public immutable batchCreation;
    IFarmRegistration public immutable farmRegistration;
    IOwnershipTransfer public immutable ownershipTransfer;
    CertificateVerification public immutable certificateVerification;
    Traceability public immutable traceability;

    struct TransparencySnapshot {
        uint256 batchId;
        string batchCode;
        uint256 farmId;
        string farmName;
        string location;
        string cropType;
        address currentOwner;
        uint256 verifiedCertificates;
        uint256 totalCertificates;
        uint256 totalTraceEvents;
        bool active;
        uint8 status;
    }

    constructor(
        address batchCreationAddress,
        address farmRegistrationAddress,
        address ownershipTransferAddress,
        address certificateVerificationAddress,
        address traceabilityAddress
    ) {
        batchCreation = IBatchCreation(batchCreationAddress);
        farmRegistration = IFarmRegistration(farmRegistrationAddress);
        ownershipTransfer = IOwnershipTransfer(ownershipTransferAddress);
        certificateVerification = CertificateVerification(certificateVerificationAddress);
        traceability = Traceability(traceabilityAddress);
    }

    function getTransparencySnapshot(uint256 batchId) external view returns (TransparencySnapshot memory) {
        (
            string memory batchCode,
            uint256 farmId,
            ,
            ,
            ,
            ,
            ,
            uint8 status,
            bool active
        ) = batchCreation.getBatchSummary(batchId);

        (string memory farmName, string memory location, string memory cropType, , , , , ) = farmRegistration
            .getFarmSummary(farmId);

        return
            TransparencySnapshot({
                batchId: batchId,
                batchCode: batchCode,
                farmId: farmId,
                farmName: farmName,
                location: location,
                cropType: cropType,
                currentOwner: ownershipTransfer.ownerOfBatch(batchId),
                verifiedCertificates: certificateVerification.getVerifiedCertificateCount(batchId),
                totalCertificates: certificateVerification.getCertificateCount(batchId),
                totalTraceEvents: traceability.getEventCount(batchId),
                active: active,
                status: status
            });
    }

    function isAuthentic(uint256 batchId) external view returns (bool) {
        (, , , , , , , , bool active) = batchCreation.getBatchSummary(batchId);
        return active && certificateVerification.getVerifiedCertificateCount(batchId) > 0;
    }
}
