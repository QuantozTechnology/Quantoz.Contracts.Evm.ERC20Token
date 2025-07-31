// SPDX-License-Identifier: MIT

pragma solidity 0.8.28;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./QuantozToken.sol";

contract QuantozTokenLZ is 
    QuantozToken,
    AccessControlUpgradeable
{
    // Role definitions
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Grant the initial role to the owner
     */
    function grantInitialRole() public onlyOwner {        
        _grantRole(DEFAULT_ADMIN_ROLE, owner());
    }

    function mint(address _to, uint256 _amount) public override onlyRole(MINTER_ROLE) {
        _mint(_to, _amount);
        emit Mint(_to, _amount);
    }

    function burn(address _from, uint256 _amount) public override onlyRole(BURNER_ROLE) {
        _burn(_from, _amount);
        emit Burn(_from, _amount);
    }
} 