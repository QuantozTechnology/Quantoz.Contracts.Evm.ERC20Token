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
        require(_to != address(0), "Token: mint to the zero address");
        require(_amount > 0, "Token: amount must be greater than 0");
        _mint(_to, _amount);
        emit Mint(_to, _amount);
    }

    function burn(address _from, uint256 _amount) public override onlyRole(BURNER_ROLE) {
        require(_from != address(0), "Token: burn from the zero address");
        require(_amount > 0, "Token: amount must be greater than 0");
        _burn(_from, _amount);
        emit Burn(_from, _amount);
    }
} 