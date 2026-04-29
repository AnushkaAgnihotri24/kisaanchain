// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IParticipantRegistry {
    function isVerifiedParticipant(address account) external view returns (bool);

    function isVerifiedRole(address account, uint8 role) external view returns (bool);

    function getParticipantRole(address account) external view returns (uint8);
}
