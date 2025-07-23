/// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import "../tokens/QuantozTokenLZ.sol";

contract ExampleUpgradedQuantozToken is QuantozTokenLZ {

    function newFunctionNotPreviouslyDefined() public pure returns (bool) {
      return true;
    }
  }
