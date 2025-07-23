# Quantoz Tokens

A comprehensive ERC-20 token implementation with upgradeable architecture, role-based access control (RBAC), and advanced security features including blocked list functionality.

## Overview

The Quantoz tokens are upgradeable ERC-20 tokens built on OpenZeppelin's upgradeable contracts framework. The project includes multiple token implementations with different feature sets:

- **QuantozToken**: Base token with owner-based minting/burning and blocked list functionality
- **QuantozTokenLZ**: Upgraded version with RBAC (Role-Based Access Control) for enhanced security
- **ExampleUpgradedQuantozToken**: Example of further upgrades demonstrating extensibility

## Features

### Core Features
- **Upgradeable Architecture**: Built using OpenZeppelin's upgradeable contracts
- **ERC-20 Standard**: Full ERC-20 compliance with additional features
- **ERC-20 Permit**: Support for gasless approvals via EIP-2612
- **Custom Decimals**: Configurable decimal places (1-18)
- **Reentrancy Protection**: Built-in security against reentrancy attacks

### Security Features
- **Blocked List**: Ability to block/unblock addresses from transfers
- **Owner Controls**: Only owner can add/remove addresses from blocked list
- **Transfer Restrictions**: Blocked addresses cannot transfer tokens
- **Contract Address Protection**: Prevents transfers to the token contract itself

### RBAC Features (QuantozTokenLZ)
- **Role-Based Access Control**: Replaces owner-only permissions with roles
- **MINTER_ROLE**: Can mint new tokens
- **BURNER_ROLE**: Can burn tokens from any address
- **DEFAULT_ADMIN_ROLE**: Can manage other roles
- **Backward Compatibility**: Maintains all original functionality

## Contract Architecture

### QuantozToken (Base Token)
```solidity
contract QuantozToken is 
    ERC20PermitUpgradeable,        
    BlockedList
{
    // Core ERC-20 functionality
    // Owner-based minting/burning
    // Blocked list integration
}
```

### QuantozTokenLZ (RBAC Upgrade)
```solidity
contract QuantozTokenLZ is 
    QuantozToken,
    AccessControlUpgradeable
{
    // All QuantozToken features
    // Role-based minting/burning
    // Enhanced security model
}
```

### BlockedList (Security Module)
```solidity
contract BlockedList is OwnableUpgradeable {
    // Blocked address management
    // Transfer restrictions
    // Owner-only controls
}
```

## Installation & Setup

### Prerequisites
- Node.js >= 16.0.0
- npm >= 8.0.0
- Hardhat
- Foundry (for advanced testing)

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd quantoz-tokens

# Install dependencies
npm install

# Install Foundry (if not already installed)
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Environment Setup
Create a `.env` file with the following variables:
```env
MNEMONIC=your_mnemonic_phrase_here
ETHEREUM_RPC_URL=your_ethereum_rpc_url
ETHERSCAN_TOKEN=your_etherscan_api_key
```

## Usage

### Deployment

#### Deploy Base Token
```bash
npx hardhat run scripts/deploy.js --network <network>
```

#### Deploy with Factory
```bash
npx hardhat run scripts/deployWithFactory.js --network <network>
```

#### Deploy MultiSig Wallet
```bash
npx hardhat run scripts/deployMultisig.js --network <network>
```

### Upgrading Tokens

#### Upgrade to RBAC Version
```javascript
const QuantozTokenLZ = await ethers.getContractFactory("QuantozTokenLZ");
await upgrades.upgradeProxy(tokenAddress, QuantozTokenLZ);
```

#### Setup RBAC Roles
```javascript
// Grant initial roles to owner
await token.grantInitialRole();

// Grant specific roles
await token.grantRole(await token.MINTER_ROLE(), minterAddress);
await token.grantRole(await token.BURNER_ROLE(), burnerAddress);
```

### Role Management

#### Grant Roles
```bash
npx hardhat run scripts/grantRole.js --network <network>
```

#### Grant Roles via MultiSig
```bash
npx hardhat run scripts/callgrantRoleMultisig.js --network <network>
```

#### Revoke Roles
```bash
npx hardhat run scripts/revokeRole.js --network <network>
```

### Token Operations

#### Minting
```javascript
// Owner-based (QuantozToken)
await token.connect(owner).mint(userAddress, amount);

// Role-based (QuantozTokenLZ)
await token.connect(minter).mint(userAddress, amount);
```

#### Burning
```javascript
// Owner-based (QuantozToken)
await token.connect(owner).burn(userAddress, amount);

// Role-based (QuantozTokenLZ)
await token.connect(burner).burn(userAddress, amount);
```

#### Blocked List Management
```javascript
// Add to blocked list
await token.connect(owner).addToBlockedList(userAddress);

// Remove from blocked list
await token.connect(owner).removeFromBlockedList(userAddress);

// Check if blocked
const isBlocked = await token.isBlocked(userAddress);
```

## Testing

### Run All Tests
```bash
npm test
```

### Run Foundry Tests
```bash
forge test
```

### Run Fuzz Tests
```bash
forge test --match-contract QuantozTokenFuzzTest
```

### Test Coverage
```bash
npx hardhat coverage
```

## Test Scenarios

The comprehensive test suite covers:

### Upgrade Scenarios
- **Basic Upgrade**: QuantozToken → QuantozTokenLZ
- **Multi-Step Upgrade**: QuantozToken → QuantozTokenLZ → ExampleUpgradedQuantozToken
- **State Preservation**: Balances, allowances, blocked lists maintained
- **Functionality Preservation**: All original features work after upgrade

### RBAC Testing
- **Role Assignment**: Granting/revoking roles
- **Permission Testing**: Role-based access control
- **Backward Compatibility**: Original owner functions still work
- **Security**: Non-role holders cannot perform restricted operations

### Blocked List Testing
- **Block/Unblock**: Adding/removing addresses
- **Transfer Restrictions**: Blocked addresses cannot transfer
- **Owner Override**: Owner can still burn from blocked addresses
- **Integration**: Works with both base and RBAC versions

### Security Testing
- **Reentrancy Protection**: Against reentrancy attacks
- **Input Validation**: Zero address, zero amount checks
- **Permission Checks**: Only authorized users can perform operations
- **Event Emission**: Proper event logging

## Security Features

### Blocked List Security
- **Owner-Only Management**: Only contract owner can modify blocked list
- **Zero Address Protection**: Cannot block zero address
- **Transfer Prevention**: Blocked addresses cannot transfer tokens
- **Owner Override**: Owner can still burn from blocked addresses

### RBAC Security
- **Role-Based Permissions**: Granular access control
- **Admin Role Management**: Only admins can grant/revoke roles
- **Separation of Concerns**: Different roles for different operations
- **Backward Compatibility**: Original owner functions preserved

### General Security
- **Reentrancy Protection**: Built-in guards against reentrancy
- **Input Validation**: Comprehensive parameter checking
- **Event Logging**: All important operations emit events
- **Upgrade Safety**: Safe upgrade patterns with state preservation

## Network Configuration

The project supports multiple networks:

### Mainnet
```javascript
mainnet: {
  url: process.env.ETHEREUM_RPC_URL,
  chainId: 1,
  accounts: accounts
}
```

### Polygon
```javascript
polygon: {
  url: "https://polygon-mainnet.infura.io/v3/...",
  chainId: 137,
  accounts: accounts
}
```

### Local Development
```javascript
hardhat: {
  // Default Hardhat network
}
```

## Scripts Reference

### Deployment Scripts
- `deploy.js`: Basic token deployment
- `deployWithFactory.js`: Factory-based deployment
- `deployMultisig.js`: MultiSig wallet deployment

### Management Scripts
- `grantRole.js`: Grant roles to addresses
- `revokeRole.js`: Revoke roles from addresses
- `getOwner.js`: Get current token owner
- `getProxyAdmin.js`: Get proxy admin address

### MultiSig Scripts
- `callgrantRoleMultisig.js`: Grant roles via MultiSig
- `callGrantBurnerRoleMultisig.js`: Grant burner role via MultiSig
- `callMintMultisig.js`: Mint tokens via MultiSig
- `callBurnMultisig.js`: Burn tokens via MultiSig
- `upgradeViaMultiSig.js`: Upgrade token via MultiSig

### Utility Scripts
- `debug.js`: Debug token state
- `debugUpgradeIssue.js`: Debug upgrade issues
- `transferOwnershipToMultiSig.js`: Transfer ownership to MultiSig

## Dependencies

### Core Dependencies
- `@openzeppelin/contracts`: 4.9.6
- `@openzeppelin/contracts-upgradeable`: 4.9.6
- `hardhat`: ^2.25.0

### Development Dependencies
- `@openzeppelin/hardhat-upgrades`: ^1.28.0
- `@nomicfoundation/hardhat-toolbox`: ^2.0.2
- `@nomicfoundation/hardhat-foundry`: ^1.1.2
- `solidity-coverage`: ^0.8.2

## License

- **QuantozToken**: MIT License
- **BlockedList**: Apache 2.0 License (based on Tether's implementation)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## Support

For questions, issues, or contributions, please:
1. Check the existing issues
2. Review the test files for usage examples
3. Consult the UPGRADE_GUIDE.md for upgrade procedures
4. Create a new issue with detailed information

## Version History

- **v1.0**: Initial QuantozToken with blocked list functionality
- **v2.0**: QuantozTokenLZ with RBAC upgrade
- **v3.0**: Example upgrades demonstrating extensibility

---

**Note**: This project is designed for production use with proper security considerations. Always audit contracts before deployment and follow security best practices.
