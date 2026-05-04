// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IParticipantRegistry.sol";

contract BuyerEnforcement is AccessControl {
    uint8 private constant BUYER_ROLE = 3;
    bytes32 public constant ESCROW_ROLE = keccak256("ESCROW_ROLE");

    struct BuyerRule {
        bool complianceApproved;
        bool termsAccepted;
        uint256 maxActiveEscrows;
        uint256 activeEscrows;
        string notes;
        uint256 updatedAt;
    }

    IParticipantRegistry public immutable participantRegistry;
    mapping(address => BuyerRule) private _buyerRules;

    event BuyerRuleUpdated(
        address indexed buyer,
        bool complianceApproved,
        bool termsAccepted,
        uint256 maxActiveEscrows
    );

    constructor(address registryAddress, address initialAdmin) {
        participantRegistry = IParticipantRegistry(registryAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
    }

    function grantEscrowRole(address escrowContract) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(ESCROW_ROLE, escrowContract);
    }

    function setBuyerRule(
        address buyer,
        bool complianceApproved,
        bool termsAccepted,
        uint256 maxActiveEscrows,
        string calldata notes
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(participantRegistry.isVerifiedRole(buyer, BUYER_ROLE), "Retailer must be verified");

        _buyerRules[buyer] = BuyerRule({
            complianceApproved: complianceApproved,
            termsAccepted: termsAccepted,
            maxActiveEscrows: maxActiveEscrows,
            activeEscrows: _buyerRules[buyer].activeEscrows,
            notes: notes,
            updatedAt: block.timestamp
        });

        emit BuyerRuleUpdated(buyer, complianceApproved, termsAccepted, maxActiveEscrows);
    }

    function canPurchase(address buyer) external view returns (bool) {
        BuyerRule storage rule = _buyerRules[buyer];
        return
            participantRegistry.isVerifiedRole(buyer, BUYER_ROLE) &&
            rule.complianceApproved &&
            rule.termsAccepted &&
            rule.activeEscrows < rule.maxActiveEscrows;
    }

    function incrementActiveEscrows(address buyer) external onlyRole(ESCROW_ROLE) {
        _buyerRules[buyer].activeEscrows += 1;
    }

    function decrementActiveEscrows(address buyer) external onlyRole(ESCROW_ROLE) {
        if (_buyerRules[buyer].activeEscrows > 0) {
            _buyerRules[buyer].activeEscrows -= 1;
        }
    }

    function getBuyerRule(address buyer) external view returns (BuyerRule memory) {
        return _buyerRules[buyer];
    }
}
