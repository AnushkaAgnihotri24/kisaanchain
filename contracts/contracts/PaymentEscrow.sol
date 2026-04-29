// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IOwnershipTransfer.sol";
import "./interfaces/IBuyerEnforcement.sol";
import "./interfaces/IBatchCreation.sol";
import "./interfaces/ITraceability.sol";
import "./interfaces/IParticipantRegistry.sol";

contract PaymentEscrow is AccessControl, ReentrancyGuard {
    enum EscrowStatus {
        PENDING,
        RELEASED,
        REFUNDED
    }

    struct EscrowRecord {
        uint256 id;
        uint256 batchId;
        address buyer;
        address seller;
        uint256 amount;
        string conditionNotes;
        bool buyerConfirmedDelivery;
        EscrowStatus status;
        uint256 createdAt;
        uint256 resolvedAt;
    }

    uint8 private constant BUYER_ROLE = 3;
    uint256 private _escrowIds;

    IOwnershipTransfer public immutable ownershipTransfer;
    IBuyerEnforcement public immutable buyerEnforcement;
    IBatchCreation public immutable batchCreation;
    ITraceability public traceability;
    IParticipantRegistry public immutable participantRegistry;

    mapping(uint256 => EscrowRecord) private _escrows;
    mapping(uint256 => uint256[]) private _batchEscrows;

    event EscrowCreated(
        uint256 indexed escrowId,
        uint256 indexed batchId,
        address indexed buyer,
        address seller,
        uint256 amount
    );
    event DeliveryConfirmed(uint256 indexed escrowId, uint256 indexed batchId, address buyer);
    event EscrowReleased(uint256 indexed escrowId, uint256 indexed batchId, address seller, uint256 amount);
    event EscrowRefunded(uint256 indexed escrowId, uint256 indexed batchId, address buyer, uint256 amount);

    constructor(
        address ownershipTransferAddress,
        address buyerEnforcementAddress,
        address batchCreationAddress,
        address traceabilityAddress,
        address registryAddress,
        address initialAdmin
    ) {
        ownershipTransfer = IOwnershipTransfer(ownershipTransferAddress);
        buyerEnforcement = IBuyerEnforcement(buyerEnforcementAddress);
        batchCreation = IBatchCreation(batchCreationAddress);
        traceability = ITraceability(traceabilityAddress);
        participantRegistry = IParticipantRegistry(registryAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
    }

    function createEscrow(
        uint256 batchId,
        address seller,
        string calldata conditionNotes
    ) external payable nonReentrant returns (uint256 escrowId) {
        require(participantRegistry.isVerifiedRole(msg.sender, BUYER_ROLE), "Only verified buyers");
        require(batchCreation.batchExists(batchId), "Batch does not exist");
        require(buyerEnforcement.canPurchase(msg.sender), "Buyer rule check failed");
        require(ownershipTransfer.ownerOfBatch(batchId) == seller, "Seller must own batch");
        require(msg.value > 0, "Escrow amount must be greater than zero");

        _escrowIds++;
        escrowId = _escrowIds;

        _escrows[escrowId] = EscrowRecord({
            id: escrowId,
            batchId: batchId,
            buyer: msg.sender,
            seller: seller,
            amount: msg.value,
            conditionNotes: conditionNotes,
            buyerConfirmedDelivery: false,
            status: EscrowStatus.PENDING,
            createdAt: block.timestamp,
            resolvedAt: 0
        });

        _batchEscrows[batchId].push(escrowId);
        buyerEnforcement.incrementActiveEscrows(msg.sender);

        traceability.recordAutomatedEvent(
            batchId,
            "ESCROW_CREATED",
            msg.sender,
            conditionNotes,
            ""
        );

        emit EscrowCreated(escrowId, batchId, msg.sender, seller, msg.value);
    }

    function confirmDelivery(uint256 escrowId) external {
        EscrowRecord storage escrow = _escrows[escrowId];
        require(escrow.buyer == msg.sender, "Only buyer can confirm delivery");
        require(escrow.status == EscrowStatus.PENDING, "Escrow is not pending");

        escrow.buyerConfirmedDelivery = true;

        traceability.recordAutomatedEvent(
            escrow.batchId,
            "DELIVERY_CONFIRMED",
            msg.sender,
            escrow.conditionNotes,
            ""
        );

        emit DeliveryConfirmed(escrowId, escrow.batchId, msg.sender);
    }

    function releaseEscrow(uint256 escrowId) external nonReentrant {
        EscrowRecord storage escrow = _escrows[escrowId];
        require(escrow.status == EscrowStatus.PENDING, "Escrow is not pending");
        require(escrow.buyerConfirmedDelivery, "Buyer has not confirmed delivery");
        require(
            ownershipTransfer.ownerOfBatch(escrow.batchId) == escrow.buyer,
            "Ownership must be transferred to buyer"
        );
        require(
            msg.sender == escrow.buyer || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Only buyer or admin"
        );

        escrow.status = EscrowStatus.RELEASED;
        escrow.resolvedAt = block.timestamp;

        (bool success, ) = payable(escrow.seller).call{value: escrow.amount}("");
        require(success, "Payment release failed");
        buyerEnforcement.decrementActiveEscrows(escrow.buyer);

        traceability.recordAutomatedEvent(
            escrow.batchId,
            "ESCROW_RELEASED",
            msg.sender,
            escrow.conditionNotes,
            ""
        );

        emit EscrowReleased(escrowId, escrow.batchId, escrow.seller, escrow.amount);
    }

    function refundEscrow(uint256 escrowId) external nonReentrant onlyRole(DEFAULT_ADMIN_ROLE) {
        EscrowRecord storage escrow = _escrows[escrowId];
        require(escrow.status == EscrowStatus.PENDING, "Escrow is not pending");

        escrow.status = EscrowStatus.REFUNDED;
        escrow.resolvedAt = block.timestamp;

        (bool success, ) = payable(escrow.buyer).call{value: escrow.amount}("");
        require(success, "Refund failed");
        buyerEnforcement.decrementActiveEscrows(escrow.buyer);

        traceability.recordAutomatedEvent(
            escrow.batchId,
            "ESCROW_REFUNDED",
            msg.sender,
            escrow.conditionNotes,
            ""
        );

        emit EscrowRefunded(escrowId, escrow.batchId, escrow.buyer, escrow.amount);
    }

    function getEscrow(uint256 escrowId) external view returns (EscrowRecord memory) {
        return _escrows[escrowId];
    }

    function getBatchEscrows(uint256 batchId) external view returns (uint256[] memory) {
        return _batchEscrows[batchId];
    }
}
