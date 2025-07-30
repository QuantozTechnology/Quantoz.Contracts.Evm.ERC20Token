// SPDX-License-Identifier: MIT

pragma solidity 0.8.28;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import "./BlockedList.sol";

contract QuantozToken is     
    ERC20PermitUpgradeable,        
    BlockedList
{
    // events
    event Burn(address indexed _from, uint256 _amount);
    event Mint(address indexed _to, uint256 _amount);

    uint8 private qDecimals;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) public virtual initializer {                
        qDecimals = _decimals;
        __Ownable_init();
        __ERC20_init(_name, _symbol);
        __ERC20Permit_init(_name);        
    }

    function decimals() public view virtual override returns (uint8) {
        return qDecimals;
    }


    function _beforeTokenTransfer(
        address from,
        address to,
        uint256
    ) internal virtual override {
        require(!isBlocked[from] || msg.sender == owner(), "Token: from is blocked");
        require( 
            to != address(this), 
            "Token: transfer to the contract address" 
        ); 
    }

    function transferFrom(
        address _sender,
        address _recipient,
        uint256 _amount
    ) public virtual override onlyNotBlocked returns (bool) {
        return super.transferFrom(_sender, _recipient, _amount);
    }    

     function mint(address _to, uint256 _amount) public virtual onlyOwner {
        _mint(_to, _amount);
        emit Mint(_to, _amount);
    }

    /**
     * @dev Burn tokens
     */
    function burn(address _from, uint256 _amount) public virtual onlyOwner {
        _burn(_from, _amount);
        emit Burn(_from, _amount);
    }

}  