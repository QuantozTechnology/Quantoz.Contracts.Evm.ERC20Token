// SPDX-License-Identifier: Apache 2.0

pragma solidity 0.8.28;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/*
   Copyright Tether.to 2020

   Author Will Harborne

   Licensed under the Apache License, Version 2.0
   http://www.apache.org/licenses/LICENSE-2.0

   ----------------------------------------------------------------------
   Amendment (2025-07-31 by raymens):
   - The contract was updated to be declared as `abstract` to indicate
     that it contains at least one function without an implementation
     and is meant to serve as a base contract.
   ----------------------------------------------------------------------
*/
abstract contract BlockedList is OwnableUpgradeable {
    ////////////////////////////
    //    State Variables     //
    ///////////////////////////
    mapping(address => bool) public isBlocked;

    ///////////////////
    //    Events     //
    //////////////////
    event BlockPlaced(address indexed _user);
    event BlockReleased(address indexed _user);

    //////////////////////
    //    Modifiers     //
    /////////////////////
    /**
     * @notice Checks if the msg.sender has been blocked.
     */
    modifier onlyNotBlocked() {
        require(!isBlocked[_msgSender()], "Blocked: msg.sender is blocked");        
        _;
    }

    //////////////////////////////////////
    //    Public/External Functions     //
    /////////////////////////////////////
    function addToBlockedList(address _user) public onlyOwner {
        require(_user != address(0), "Blocked: cannot block zero address");
        isBlocked[_user] = true;
        emit BlockPlaced(_user);
    }

    function removeFromBlockedList(address _user) public onlyOwner {
        require(_user != address(0), "Blocked: cannot block zero address");
        isBlocked[_user] = false;
        emit BlockReleased(_user);
    }
}