// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBuyerEnforcement {
    function canPurchase(address buyer) external view returns (bool);

    function incrementActiveEscrows(address buyer) external;

    function decrementActiveEscrows(address buyer) external;
}
