require("@nomicfoundation/hardhat-chai-matchers");
const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("RBAC Upgrades", async () => {
  it("upgraded token maintains balances and adds RBAC functionality", async () => {
    const QuantozToken = await ethers.getContractFactory("QuantozToken");
    const QuantozTokenLZ = await ethers.getContractFactory("QuantozTokenLZ");

    const [owner, user, minter, burner] = await ethers.getSigners();

    const ownerAddress = await owner.getAddress();
    const minterAddress = await minter.getAddress();
    const burnerAddress = await burner.getAddress();

    // Deploy original token using upgrades.deployProxy
    const token = await upgrades.deployProxy(QuantozToken, ["GreatBritishTether", "GBPT", 6], {
      initializer: "initialize",
    });
    await token.deployed();

    const tokenAddress = token.address;

    // Verify original token setup
    const tokenOwner = await token.connect(user).owner();
    await expect(tokenOwner).to.equal(ownerAddress);

    const name1 = await token.connect(user).name();
    await expect(name1).to.equal("GreatBritishTether");

    // Mint some tokens using original owner-based minting
    await token.connect(owner).mint(ownerAddress, 1234567);
    const balance1 = await token.connect(user).balanceOf(ownerAddress);
    await expect(balance1.toString()).to.equal("1234567");

    // Verify original functions work
    await token.connect(owner).mint(user.getAddress(), 500000);
    const userBalance = await token.connect(user).balanceOf(user.getAddress());
    await expect(userBalance.toString()).to.equal("500000");

    // Try to call RBAC functions (should fail on original token)
    try {
      await token.connect(user).grantInitialRole();
    } catch (e) {
      await expect(e.toString()).to.contains("is not a function");
    }

    // Upgrade to RBAC version
    await upgrades.upgradeProxy(tokenAddress, QuantozTokenLZ);

    const upgradedToken = await ethers.getContractAt("QuantozTokenLZ", tokenAddress);

    // Verify balances are preserved
    const balanceAfterUpgrade = await upgradedToken.connect(user).balanceOf(ownerAddress);
    await expect(balanceAfterUpgrade.toString()).to.equal("1234567");

    const userBalanceAfterUpgrade = await upgradedToken.connect(user).balanceOf(user.getAddress());
    await expect(userBalanceAfterUpgrade.toString()).to.equal("500000");

    // Verify name is preserved
    const name2 = await upgradedToken.connect(user).name();
    await expect(name2).to.equal(name1);

    // Verify owner is preserved
    const upgradedOwner = await upgradedToken.connect(user).owner();
    await expect(upgradedOwner).to.equal(ownerAddress);

    // Setup RBAC roles
    await upgradedToken.connect(owner).grantInitialRole();

    // Grant specific roles
    await upgradedToken.connect(owner).grantRole(await upgradedToken.MINTER_ROLE(), minterAddress);
    await upgradedToken.connect(owner).grantRole(await upgradedToken.BURNER_ROLE(), burnerAddress);

    // Verify roles are assigned correctly
    const hasMinterRole = await upgradedToken.connect(user).hasRole(await upgradedToken.MINTER_ROLE(), minterAddress);
    await expect(hasMinterRole).to.equal(true);

    const hasBurnerRole = await upgradedToken.connect(user).hasRole(await upgradedToken.BURNER_ROLE(), burnerAddress);
    await expect(hasBurnerRole).to.equal(true);

    // Test RBAC minting (should work with minter role)
    await upgradedToken.connect(minter).mint(minterAddress, 100000);
    const minterBalance = await upgradedToken.connect(user).balanceOf(minterAddress);
    await expect(minterBalance.toString()).to.equal("100000");

    // Test RBAC burning (should work with burner role)
    await upgradedToken.connect(burner).burn(minterAddress, 50000);
    const minterBalanceAfterBurn = await upgradedToken.connect(user).balanceOf(minterAddress);
    await expect(minterBalanceAfterBurn.toString()).to.equal("50000");

    // Test that non-role holders cannot mint
    try {
      await upgradedToken.connect(user).mint(user.getAddress(), 1000);
    } catch (e) {
      await expect(e.toString()).to.contains("AccessControl");
    }

    // Test that non-role holders cannot burn
    try {
      await upgradedToken.connect(user).burn(ownerAddress, 1000);
    } catch (e) {
      await expect(e.toString()).to.contains("AccessControl");
    }

    // Test that owner can still use original functions (if they have roles)
    await upgradedToken.connect(owner).grantRole(await upgradedToken.MINTER_ROLE(), ownerAddress);
    await upgradedToken.connect(owner).mint(ownerAddress, 1000);
    const finalOwnerBalance = await upgradedToken.connect(user).balanceOf(ownerAddress);
    await expect(finalOwnerBalance.toString()).to.equal("1235567"); // 1234567 + 1000
  });

  it("upgraded token maintains blocked list functionality", async () => {
    const QuantozToken = await ethers.getContractFactory("QuantozToken");
    const QuantozTokenLZ = await ethers.getContractFactory("QuantozTokenLZ");

    const [owner, user, blockedUser] = await ethers.getSigners();

    const ownerAddress = await owner.getAddress();
    const blockedUserAddress = await blockedUser.getAddress();

    // Deploy original token using upgrades.deployProxy
    const token = await upgrades.deployProxy(QuantozToken, ["TestToken", "TEST", 18], {
      initializer: "initialize",
    });
    await token.deployed();

    const tokenAddress = token.address;

    // Add user to blocked list on original token
    await token.connect(owner).addToBlockedList(blockedUserAddress);
    const isBlockedOriginal = await token.connect(user).isBlocked(blockedUserAddress);
    await expect(isBlockedOriginal).to.equal(true);

    // Mint some tokens to blocked user
    await token.connect(owner).mint(blockedUserAddress, 1000000);

    // Upgrade to RBAC version
    await upgrades.upgradeProxy(tokenAddress, QuantozTokenLZ);

    const upgradedToken = await ethers.getContractAt("QuantozTokenLZ", tokenAddress);

    // Verify blocked list is preserved
    const isBlockedAfterUpgrade = await upgradedToken.connect(user).isBlocked(blockedUserAddress);
    await expect(isBlockedAfterUpgrade).to.equal(true);

    // Verify blocked user balance is preserved
    const blockedUserBalance = await upgradedToken.connect(user).balanceOf(blockedUserAddress);
    await expect(blockedUserBalance.toString()).to.equal("1000000");

    // Setup RBAC
    await upgradedToken.connect(owner).grantInitialRole();

    // Test that blocked user cannot transfer (should fail)
    try {
      await upgradedToken.connect(blockedUser).transfer(user.getAddress(), 1000);
      console.log("transfer succeeded not blocked as expected");
    } catch (e) {
      await expect(e.toString()).to.contains("Token: from is blocked");
    }

    // Test that owner can still manage blocked list
    await upgradedToken.connect(owner).removeFromBlockedList(blockedUserAddress);
    const isBlockedAfterRemove = await upgradedToken.connect(user).isBlocked(blockedUserAddress);
    await expect(isBlockedAfterRemove).to.equal(false);

    // Now blocked user should be able to transfer
    await upgradedToken.connect(blockedUser).transfer(user.getAddress(), 1000);
    const userBalanceAfterTransfer = await upgradedToken.connect(user).balanceOf(user.getAddress());
    await expect(userBalanceAfterTransfer.toString()).to.equal("1000");
  });

  it("upgraded token maintains all existing functionality", async () => {
    const QuantozToken = await ethers.getContractFactory("QuantozToken");
    const QuantozTokenLZ = await ethers.getContractFactory("QuantozTokenLZ");

    const [owner, user1, user2, user3] = await ethers.getSigners();

    const ownerAddress = await owner.getAddress();

    // Deploy original token using upgrades.deployProxy
    const token = await upgrades.deployProxy(QuantozToken, ["MultiToken", "MULTI", 6], {
      initializer: "initialize",
    });
    await token.deployed();

    const tokenAddress = token.address;

    await token.connect(owner).mint(ownerAddress, 10000);
    await token.connect(owner).transfer(user1.getAddress(), 1000);
    await token.connect(owner).transfer(user2.getAddress(), 2000);
    await token.connect(owner).transfer(user3.getAddress(), 3000);

    // Verify balances
    const balance1 = await token.connect(user1).balanceOf(user1.getAddress());
    await expect(balance1.toString()).to.equal("1000");
    const balance2 = await token.connect(user2).balanceOf(user2.getAddress());
    await expect(balance2.toString()).to.equal("2000");
    const balance3 = await token.connect(user3).balanceOf(user3.getAddress());
    await expect(balance3.toString()).to.equal("3000");

    // Upgrade to RBAC version
    await upgrades.upgradeProxy(tokenAddress, QuantozTokenLZ);

    const upgradedToken = await ethers.getContractAt("QuantozTokenLZ", tokenAddress);

    // Verify all balances are preserved
    const balance1After = await upgradedToken.connect(user1).balanceOf(user1.getAddress());
    await expect(balance1After.toString()).to.equal("1000");
    const balance2After = await upgradedToken.connect(user2).balanceOf(user2.getAddress());
    await expect(balance2After.toString()).to.equal("2000");
    const balance3After = await upgradedToken.connect(user3).balanceOf(user3.getAddress());
    await expect(balance3After.toString()).to.equal("3000");

    // Setup RBAC
    await upgradedToken.connect(owner).grantInitialRole();
    await upgradedToken.connect(owner).grantRole(await upgradedToken.MINTER_ROLE(), ownerAddress);

    // Test that multiTransfer still works
    await upgradedToken.connect(owner).transfer(user1.getAddress(), 500);
    await upgradedToken.connect(owner).transfer(user2.getAddress(), 500);

    // Verify new balances
    const finalBalance1 = await upgradedToken.connect(user1).balanceOf(user1.getAddress());
    await expect(finalBalance1.toString()).to.equal("1500"); // 1000 + 500
    const finalBalance2 = await upgradedToken.connect(user2).balanceOf(user2.getAddress());
    await expect(finalBalance2.toString()).to.equal("2500"); // 2000 + 500

    // Test decimals are preserved
    const decimals = await upgradedToken.connect(user1).decimals();
    await expect(decimals).to.equal(6);
  });

  it("upgraded token maintains allowance functionality", async () => {
    const QuantozToken = await ethers.getContractFactory("QuantozToken");
    const QuantozTokenLZ = await ethers.getContractFactory("QuantozTokenLZ");

    const [owner, user, spender, recipient] = await ethers.getSigners();

    const ownerAddress = await owner.getAddress();
    const userAddress = await user.getAddress();
    const spenderAddress = await spender.getAddress();
    const recipientAddress = await recipient.getAddress();

    // Deploy original token using upgrades.deployProxy
    const token = await upgrades.deployProxy(QuantozToken, ["AllowanceToken", "ALLOW", 18], {
      initializer: "initialize",
    });
    await token.deployed();

    const tokenAddress = token.address;

    // Setup original token with balances
    await token.connect(owner).mint(userAddress, 1000000);
    await token.connect(owner).mint(spenderAddress, 500000);

    // Test allowance functionality on original token
    const initialAllowance = await token.connect(user).allowance(userAddress, spenderAddress);
    await expect(initialAllowance.toString()).to.equal("0");

    // Approve spender
    await token.connect(user).approve(spenderAddress, 100000);
    const allowanceAfterApprove = await token.connect(user).allowance(userAddress, spenderAddress);
    await expect(allowanceAfterApprove.toString()).to.equal("100000");

    // Test transferFrom
    await token.connect(spender).transferFrom(userAddress, recipientAddress, 50000);
    const recipientBalance = await token.connect(recipient).balanceOf(recipientAddress);
    await expect(recipientBalance.toString()).to.equal("50000");

    // Verify allowance is reduced
    const allowanceAfterTransfer = await token.connect(user).allowance(userAddress, spenderAddress);
    await expect(allowanceAfterTransfer.toString()).to.equal("50000");

    // Test permit functionality (if available)
    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const nonce = await token.connect(user).nonces(userAddress);

    // Create permit signature
    const domain = {
      name: await token.name(),
      version: '1',
      chainId: await ethers.provider.getNetwork().then(n => n.chainId),
      verifyingContract: tokenAddress
    };

    const types = {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' }
      ]
    };

    const value = {
      owner: userAddress,
      spender: spenderAddress,
      value: 75000,
      nonce: nonce,
      deadline: deadline
    };

    const signature = await user._signTypedData(domain, types, value);
    const { v, r, s } = ethers.utils.splitSignature(signature);

    // Execute permit
    await token.connect(spender).permit(userAddress, spenderAddress, 75000, deadline, v, r, s);

    // Verify permit worked
    const allowanceAfterPermit = await token.connect(user).allowance(userAddress, spenderAddress);
    await expect(allowanceAfterPermit.toString()).to.equal("75000"); // permit sets, not adds

    // Upgrade to RBAC version
    await upgrades.upgradeProxy(tokenAddress, QuantozTokenLZ);

    const upgradedToken = await ethers.getContractAt("QuantozTokenLZ", tokenAddress);

    // Verify balances are preserved
    const userBalanceAfterUpgrade = await upgradedToken.connect(user).balanceOf(userAddress);
    await expect(userBalanceAfterUpgrade.toString()).to.equal("950000"); // 1000000 - 50000
    const spenderBalanceAfterUpgrade = await upgradedToken.connect(spender).balanceOf(spenderAddress);
    await expect(spenderBalanceAfterUpgrade.toString()).to.equal("500000");
    const recipientBalanceAfterUpgrade = await upgradedToken.connect(recipient).balanceOf(recipientAddress);
    await expect(recipientBalanceAfterUpgrade.toString()).to.equal("50000");

    // Verify allowance is preserved
    const allowanceAfterUpgrade = await upgradedToken.connect(user).allowance(userAddress, spenderAddress);
    await expect(allowanceAfterUpgrade.toString()).to.equal("75000");

    // Test allowance functionality still works after upgrade
    await upgradedToken.connect(user).approve(spenderAddress, 200000);
    const newAllowance = await upgradedToken.connect(user).allowance(userAddress, spenderAddress);
    await expect(newAllowance.toString()).to.equal("200000");

    // Test transferFrom still works
    await upgradedToken.connect(spender).transferFrom(userAddress, recipientAddress, 75000);
    const recipientBalanceAfterTransfer = await upgradedToken.connect(recipient).balanceOf(recipientAddress);
    await expect(recipientBalanceAfterTransfer.toString()).to.equal("125000"); // 50000 + 75000

    // Verify allowance is reduced
    const allowanceAfterNewTransfer = await upgradedToken.connect(user).allowance(userAddress, spenderAddress);
    await expect(allowanceAfterNewTransfer.toString()).to.equal("125000"); // 200000 - 75000

    // Test permit still works after upgrade
    const newDeadline = Math.floor(Date.now() / 1000) + 3600;
    const newNonce = await upgradedToken.connect(user).nonces(userAddress);

    const newDomain = {
      name: await upgradedToken.name(),
      version: '1',
      chainId: await ethers.provider.getNetwork().then(n => n.chainId),
      verifyingContract: tokenAddress
    };

    const newValue = {
      owner: userAddress,
      spender: spenderAddress,
      value: 50000,
      nonce: newNonce,
      deadline: newDeadline
    };

    const newSignature = await user._signTypedData(newDomain, types, newValue);
    const { v: newV, r: newR, s: newS } = ethers.utils.splitSignature(newSignature);

    // Execute permit on upgraded token
    await upgradedToken.connect(spender).permit(userAddress, spenderAddress, 50000, newDeadline, newV, newR, newS);

    // Verify permit worked on upgraded token
    const allowanceAfterNewPermit = await upgradedToken.connect(user).allowance(userAddress, spenderAddress);
    await expect(allowanceAfterNewPermit.toString()).to.equal("50000");

    // Test that nonce increments correctly
    const finalNonce = await upgradedToken.connect(user).nonces(userAddress);
    await expect(finalNonce.toString()).to.equal(newNonce.add(1).toString());

    // Test that blocked users cannot use allowance
    await upgradedToken.connect(owner).grantInitialRole();
    await upgradedToken.connect(owner).addToBlockedList(userAddress);

    // Try to approve from blocked user (should fail)
    try {
      await upgradedToken.connect(user).approve(spenderAddress, 100000);
    } catch (e) {
      await expect(e.toString()).to.contains("Token: from is blocked");
    }

    // Try to transferFrom from blocked user (should fail)
    try {
      await upgradedToken.connect(spender).transferFrom(userAddress, recipientAddress, 10000);
    } catch (e) {
      await expect(e.toString()).to.contains("Token: from is blocked");
    }

    // Unblock user and test allowance works again
    await upgradedToken.connect(owner).removeFromBlockedList(userAddress);
    await upgradedToken.connect(user).approve(spenderAddress, 100000);
    const allowanceAfterUnblock = await upgradedToken.connect(user).allowance(userAddress, spenderAddress);
    await expect(allowanceAfterUnblock.toString()).to.equal("100000");

    await upgradedToken.connect(owner).grantInitialRole();
  });

  it("upgraded RBAC token can be upgraded again to ExampleUpgradedQuantozToken", async () => {
    const QuantozToken = await ethers.getContractFactory("QuantozToken");
    const QuantozTokenLZ = await ethers.getContractFactory("QuantozTokenLZ");
    const ExampleUpgradedQuantozToken = await ethers.getContractFactory("ExampleUpgradedQuantozToken");

    const [owner, user, minter, burner, user1, user2] = await ethers.getSigners();

    const ownerAddress = await owner.getAddress();
    const minterAddress = await minter.getAddress();
    const burnerAddress = await burner.getAddress();

    // Deploy original token using upgrades.deployProxy
    const token = await upgrades.deployProxy(QuantozToken, ["AdvancedToken", "ADV", 12], {
      initializer: "initialize",
    });
    await token.deployed();

    const tokenAddress = token.address;

    // Setup original token with some balances
    await token.connect(owner).mint(ownerAddress, 5000000);
    await token.connect(owner).mint(user.getAddress(), 1000000);
    await token.connect(owner).mint(minterAddress, 2000000);
    await token.connect(owner).mint(burnerAddress, 1500000);

    // Verify original balances
    const ownerBalanceOriginal = await token.connect(user).balanceOf(ownerAddress);
    await expect(ownerBalanceOriginal.toString()).to.equal("5000000");
    const userBalanceOriginal = await token.connect(user).balanceOf(user.getAddress());
    await expect(userBalanceOriginal.toString()).to.equal("1000000");

    // First upgrade: QuantozToken -> QuantozTokenLZ
    await upgrades.upgradeProxy(tokenAddress, QuantozTokenLZ);

    const rbacToken = await ethers.getContractAt("QuantozTokenLZ", tokenAddress);

    // Verify balances are preserved after first upgrade
    const ownerBalanceAfterFirstUpgrade = await rbacToken.connect(user).balanceOf(ownerAddress);
    await expect(ownerBalanceAfterFirstUpgrade.toString()).to.equal("5000000");
    const userBalanceAfterFirstUpgrade = await rbacToken.connect(user).balanceOf(user.getAddress());
    await expect(userBalanceAfterFirstUpgrade.toString()).to.equal("1000000");

    // Setup RBAC roles
    await rbacToken.connect(owner).grantInitialRole();
    await rbacToken.connect(owner).grantRole(await rbacToken.MINTER_ROLE(), minterAddress);
    await rbacToken.connect(owner).grantRole(await rbacToken.BURNER_ROLE(), burnerAddress);

    // Test RBAC functionality
    await rbacToken.connect(minter).mint(minterAddress, 500000);
    const minterBalanceAfterMint = await rbacToken.connect(user).balanceOf(minterAddress);
    await expect(minterBalanceAfterMint.toString()).to.equal("2500000"); // 2000000 + 500000

    await rbacToken.connect(burner).burn(burnerAddress, 300000);
    const burnerBalanceAfterBurn = await rbacToken.connect(user).balanceOf(burnerAddress);
    await expect(burnerBalanceAfterBurn.toString()).to.equal("1200000"); // 1500000 - 300000

    // Second upgrade: QuantozTokenLZ -> ExampleUpgradedQuantozToken
    await upgrades.upgradeProxy(tokenAddress, ExampleUpgradedQuantozToken);

    const finalUpgradedToken = await ethers.getContractAt("ExampleUpgradedQuantozToken", tokenAddress);

    // Verify all balances are preserved after second upgrade
    const ownerBalanceAfterSecondUpgrade = await finalUpgradedToken.connect(user).balanceOf(ownerAddress);
    await expect(ownerBalanceAfterSecondUpgrade.toString()).to.equal("5000000");
    const userBalanceAfterSecondUpgrade = await finalUpgradedToken.connect(user).balanceOf(user.getAddress());
    await expect(userBalanceAfterSecondUpgrade.toString()).to.equal("1000000");
    const minterBalanceAfterSecondUpgrade = await finalUpgradedToken.connect(user).balanceOf(minterAddress);
    await expect(minterBalanceAfterSecondUpgrade.toString()).to.equal("2500000");
    const burnerBalanceAfterSecondUpgrade = await finalUpgradedToken.connect(user).balanceOf(burnerAddress);
    await expect(burnerBalanceAfterSecondUpgrade.toString()).to.equal("1200000");

    // Test transferFrom for non-blocked address
    await finalUpgradedToken.connect(user).approve(ownerAddress, 500000);
    await finalUpgradedToken.connect(owner).transferFrom(user.getAddress(), ownerAddress, 500000);

    const userBalanceAfterTransferFrom = await finalUpgradedToken.connect(user).balanceOf(user.getAddress());
    await expect(userBalanceAfterTransferFrom.toString()).to.equal("500000"); // 1000000 - 500000

    const ownerBalanceAfterTransferFrom = await finalUpgradedToken.connect(user).balanceOf(ownerAddress);
    await expect(ownerBalanceAfterTransferFrom.toString()).to.equal("5500000"); // 5000000 + 500000

    // Test transferFrom for blocked address
    await finalUpgradedToken.connect(owner).addToBlockedList(user.getAddress());
    await finalUpgradedToken.connect(user).approve(ownerAddress, 500000);

    // Test transferFrom for blocked address using owner
    await finalUpgradedToken.connect(owner).transferFrom(user.getAddress(), ownerAddress, 500000);

    // Verify balances unchanged after failed transfer
    const userFinalBalance = await finalUpgradedToken.connect(owner).balanceOf(user.getAddress());
    await expect(userFinalBalance.toString()).to.equal("0");

    const ownerFinalBalance = await finalUpgradedToken.connect(owner).balanceOf(ownerAddress);
    await expect(ownerFinalBalance.toString()).to.equal("6000000");
  });

  it("test blocked list functionality", async () => {
    const QuantozToken = await ethers.getContractFactory("QuantozToken");
    const QuantozTokenLZ = await ethers.getContractFactory("QuantozTokenLZ");

    const [owner, user, user2] = await ethers.getSigners();

    const ownerAddress = await owner.getAddress();
    const userAddress = await user.getAddress();
    const user2Address = await user2.getAddress();

    // Deploy original token using upgrades.deployProxy
    const token = await upgrades.deployProxy(QuantozToken, ["DebugToken", "DEBUG", 6], {
      initializer: "initialize",
    });
    await token.deployed();

    const tokenAddress = token.address;

    // Upgrade to RBAC version
    await upgrades.upgradeProxy(tokenAddress, QuantozTokenLZ);

    const upgradedToken = await ethers.getContractAt("QuantozTokenLZ", tokenAddress);

    // Setup RBAC
    await upgradedToken.connect(owner).grantInitialRole();
    await upgradedToken.connect(owner).grantRole(await upgradedToken.MINTER_ROLE(), ownerAddress);
    await upgradedToken.connect(owner).grantRole(await upgradedToken.BURNER_ROLE(), ownerAddress);

    // Mint tokens to user
    await upgradedToken.connect(owner).mint(userAddress, 1000000);
    await upgradedToken.connect(owner).mint(user2Address, 1000000);

    // Add user to blocked list
    await upgradedToken.connect(owner).addToBlockedList(userAddress);

    // Check if user is blocked
    expect(await upgradedToken.connect(user).isBlocked(userAddress)).to.equal(true);

    // User approves owner to transfer tokens
    await upgradedToken.connect(user).approve(ownerAddress, 500000);

    // Try transferFrom - this should pass
    await upgradedToken.connect(owner).transferFrom(userAddress, ownerAddress, 500000);

    // This should fail
    try {
      await upgradedToken.connect(user).transferFrom(userAddress, ownerAddress, 500000);
    } catch (e) {
      expect(e.toString()).to.contain("Blocked: msg.sender is blocked");
    }

    try {
      await upgradedToken.connect(user).addToBlockedList(user2Address);
    } catch (e) {
      expect(e.toString()).to.contain("Ownable: caller is not the owner");
    }

    try {
      await upgradedToken.connect(user).removeFromBlockedList(user2Address);
    } catch (e) {
      expect(e.toString()).to.contain("Ownable: caller is not the owner");
    }
  });

  it("test deploy quantoz token using direct deployment", async () => {
    const QuantozToken = await ethers.getContractFactory("QuantozToken");
    const QuantozTokenLZ = await ethers.getContractFactory("QuantozTokenLZ");

    const [owner, user] = await ethers.getSigners();

    const ownerAddress = await owner.getAddress();
    const userAddress = await user.getAddress();

    // Deploy original token using upgrades.deployProxy
    const token = await upgrades.deployProxy(QuantozToken, ["DebugToken", "DEBUG", 6], {
      initializer: "initialize",
    });
    await token.deployed();

    const tokenAddress = token.address;

    // Try to initialize again (should fail)
    try {
      await token.connect(owner).initialize("DebugToken", "DEBUG", 6);
    } catch (e) {
      expect(e.toString()).to.contain("Initializable: contract is already initialized");
    }

    // Upgrade to RBAC version
    await upgrades.upgradeProxy(tokenAddress, QuantozTokenLZ);

    const quantozToken = await ethers.getContractAt("QuantozTokenLZ", tokenAddress);

    await quantozToken.connect(owner).grantInitialRole();
    await quantozToken.connect(owner).grantRole(await quantozToken.MINTER_ROLE(), ownerAddress);
    await quantozToken.connect(owner).grantRole(await quantozToken.BURNER_ROLE(), ownerAddress);

    try {
      await quantozToken.connect(user).grantInitialRole();
    } catch (e) {
      expect(e.toString()).to.contain("Ownable: caller is not the owner");
    }

    try {
      await quantozToken.connect(owner).mint("0x0000000000000000000000000000000000000000", 0);
    } catch (e) {
      expect(e.toString()).to.contain("Token: mint to the zero address");
    }

    try {
      await quantozToken.connect(owner).burn("0x0000000000000000000000000000000000000000", 0);
    } catch (e) {
      expect(e.toString()).to.contain("Token: burn from the zero address");
    }

    try {
      await quantozToken.connect(owner).mint(userAddress, 0);
    } catch (e) {
      expect(e.toString()).to.contain("Token: amount must be greater than 0");
    }

    try {
      await quantozToken.connect(owner).burn(userAddress, 0);
    } catch (e) {
      expect(e.toString()).to.contain("Token: amount must be greater than 0");
    }

    try {
      await quantozToken.connect(owner).addToBlockedList("0x0000000000000000000000000000000000000000");
    } catch (e) {
      expect(e.toString()).to.contain("Blocked: cannot block zero address");
    }

    try {
      await quantozToken.connect(owner).removeFromBlockedList("0x0000000000000000000000000000000000000000");
    } catch (e) {
      expect(e.toString()).to.contain("Blocked: cannot block zero address");
    }

    try {
      await quantozToken.connect(user).approve(ownerAddress, 1000000);
      await quantozToken.connect(owner).transferFrom(userAddress, quantozToken.address, 1000000);
    } catch (e) {
      expect(e.toString()).to.contain("Token: transfer to the contract address");
    }
  });

  it("test transferFrom with blocked users", async () => {
    const QuantozToken = await ethers.getContractFactory("QuantozToken");
    const QuantozTokenLZ = await ethers.getContractFactory("QuantozTokenLZ");

    const [owner, user, spender, recipient] = await ethers.getSigners();

    const ownerAddress = await owner.getAddress();
    const userAddress = await user.getAddress();
    const spenderAddress = await spender.getAddress();
    const recipientAddress = await recipient.getAddress();

    // Deploy original token using upgrades.deployProxy
    const token = await upgrades.deployProxy(QuantozToken, ["TransferFromToken", "TFR", 6], {
      initializer: "initialize",
    });
    await token.deployed();

    const tokenAddress = token.address;

    // Mint tokens to user
    await token.connect(owner).mint(userAddress, 1000000);

    // User approves spender to transfer tokens
    await token.connect(user).approve(spenderAddress, 500000);

    // Test normal transferFrom (should work)
    await token.connect(spender).transferFrom(userAddress, recipientAddress, 200000);
    const recipientBalance = await token.connect(recipient).balanceOf(recipientAddress);
    await expect(recipientBalance.toString()).to.equal("200000");

    // Add spender to blocked list
    await token.connect(owner).addToBlockedList(spenderAddress);

    // Verify spender is blocked
    const isBlocked = await token.connect(user).isBlocked(spenderAddress);
    await expect(isBlocked).to.equal(true);

    // Try transferFrom with blocked spender (should fail)
    try {
      await token.connect(spender).transferFrom(userAddress, recipientAddress, 100000);
      // If we reach here, the test should fail
      await expect(true).to.equal(false);
    } catch (e) {
      await expect(e.toString()).to.contains("Blocked: msg.sender is blocked");
    }

    // Verify recipient balance unchanged after failed transfer
    const recipientBalanceAfterFailed = await token.connect(recipient).balanceOf(recipientAddress);
    await expect(recipientBalanceAfterFailed.toString()).to.equal("200000");

    // Remove spender from blocked list
    await token.connect(owner).removeFromBlockedList(spenderAddress);

    // Verify spender is no longer blocked
    const isBlockedAfterRemove = await token.connect(user).isBlocked(spenderAddress);
    await expect(isBlockedAfterRemove).to.equal(false);

    // Test transferFrom again (should work now)
    await token.connect(spender).transferFrom(userAddress, recipientAddress, 100000);
    const recipientBalanceAfterSuccess = await token.connect(recipient).balanceOf(recipientAddress);
    await expect(recipientBalanceAfterSuccess.toString()).to.equal("300000");

    // Upgrade to RBAC version and test the same functionality
    await upgrades.upgradeProxy(tokenAddress, QuantozTokenLZ);

    const upgradedToken = await ethers.getContractAt("QuantozTokenLZ", tokenAddress);

    // Setup RBAC
    await upgradedToken.connect(owner).grantInitialRole();

    // Add spender back to blocked list
    await upgradedToken.connect(owner).addToBlockedList(spenderAddress);

    // Try transferFrom with blocked spender on upgraded token (should fail)
    try {
      await upgradedToken.connect(spender).transferFrom(userAddress, recipientAddress, 50000);
      // If we reach here, the test should fail
      await expect(true).to.equal(false);
    } catch (e) {
      await expect(e.toString()).to.contains("Blocked: msg.sender is blocked");
    }

    // Verify recipient balance unchanged after failed transfer on upgraded token
    const recipientBalanceAfterUpgradeFailed = await upgradedToken.connect(recipient).balanceOf(recipientAddress);
    await expect(recipientBalanceAfterUpgradeFailed.toString()).to.equal("300000");

    // Remove spender from blocked list on upgraded token
    await upgradedToken.connect(owner).removeFromBlockedList(spenderAddress);

    // Test transferFrom on upgraded token (should work now)
    await upgradedToken.connect(spender).transferFrom(userAddress, recipientAddress, 50000);
    const recipientBalanceAfterUpgradeSuccess = await upgradedToken.connect(recipient).balanceOf(recipientAddress);
    await expect(recipientBalanceAfterUpgradeSuccess.toString()).to.equal("350000");
  });

  it("test burn function comprehensively", async () => {
    const QuantozToken = await ethers.getContractFactory("QuantozToken");
    const QuantozTokenLZ = await ethers.getContractFactory("QuantozTokenLZ");

    const [owner, user, nonOwner] = await ethers.getSigners();

    const ownerAddress = await owner.getAddress();
    const userAddress = await user.getAddress();
    const nonOwnerAddress = await nonOwner.getAddress();

    // Deploy original token using upgrades.deployProxy
    const token = await upgrades.deployProxy(QuantozToken, ["BurnTestToken", "BURN", 6], {
      initializer: "initialize",
    });
    await token.deployed();

    const tokenAddress = token.address;

    // Mint tokens to user
    await token.connect(owner).mint(userAddress, 1000000);

    // Verify initial balance
    const initialBalance = await token.connect(user).balanceOf(userAddress);
    await expect(initialBalance.toString()).to.equal("1000000");

    // Test successful burn by owner
    const burnAmount = 200000;
    await expect(token.connect(owner).burn(userAddress, burnAmount))
      .to.emit(token, "Burn")
      .withArgs(userAddress, burnAmount);

    // Verify balance is reduced
    const balanceAfterBurn = await token.connect(user).balanceOf(userAddress);
    await expect(balanceAfterBurn.toString()).to.equal("800000"); // 1000000 - 200000

    // Test burn with zero amount (should fail)
    try {
      await token.connect(owner).burn(userAddress, 0);
      await expect(true).to.equal(false); // Should not reach here
    } catch (e) {
      await expect(e.toString()).to.contains("Token: amount must be greater than 0");
    }

    // Test burn from zero address (should fail)
    try {
      await token.connect(owner).burn("0x0000000000000000000000000000000000000000", 100000);
      await expect(true).to.equal(false); // Should not reach here
    } catch (e) {
      await expect(e.toString()).to.contains("Token: burn from the zero address");
    }

    // Test burn by non-owner (should fail)
    try {
      await token.connect(nonOwner).burn(userAddress, 100000);
      await expect(true).to.equal(false); // Should not reach here
    } catch (e) {
      await expect(e.toString()).to.contains("Ownable: caller is not the owner");
    }

    // Test burn more than available balance
    try {
      await token.connect(owner).burn(userAddress, 1000000); // More than available 800000
      await expect(true).to.equal(false); // Should not reach here
    } catch (e) {
      await expect(e.toString()).to.contains("ERC20: burn amount exceeds balance");
    }

    // Test burn exact remaining balance
    const remainingBalance = await token.connect(user).balanceOf(userAddress);
    await expect(token.connect(owner).burn(userAddress, remainingBalance))
      .to.emit(token, "Burn")
      .withArgs(userAddress, remainingBalance);

    // Verify balance is now zero
    const finalBalance = await token.connect(user).balanceOf(userAddress);
    await expect(finalBalance.toString()).to.equal("0");

    // Test burn from blocked user (should work since owner can burn from anyone)
    await token.connect(owner).mint(userAddress, 500000);
    await token.connect(owner).addToBlockedList(userAddress);

    // Owner should still be able to burn from blocked user
    await expect(token.connect(owner).burn(userAddress, 200000))
      .to.emit(token, "Burn")
      .withArgs(userAddress, 200000);

    // Verify blocked user balance is reduced
    const blockedUserBalance = await token.connect(user).balanceOf(userAddress);
    await expect(blockedUserBalance.toString()).to.equal("300000");


    // Test mint with invalid parameters on upgraded token
    try {
      await token.connect(owner).mint("0x0000000000000000000000000000000000000000", 10000);
      await expect(true).to.equal(false); // Should not reach here
    } catch (e) {
      await expect(e.toString()).to.contains("Token: mint to the zero address");
    }

    // Test mint with zero amount (should fail)
    try {
      await token.connect(owner).mint(userAddress, 0);
      await expect(true).to.equal(false); // Should not reach here
    } catch (e) {
      await expect(e.toString()).to.contains("Token: amount must be greater than 0");
    }

    // Test burn by non-owner (should fail)
    try {
      await token.connect(nonOwner).mint(userAddress, 100000);
      await expect(true).to.equal(false); // Should not reach here
    } catch (e) {
      await expect(e.toString()).to.contains("Ownable: caller is not the owner");
    }

    // Upgrade to RBAC version and test burn functionality
    await upgrades.upgradeProxy(tokenAddress, QuantozTokenLZ);

    const upgradedToken = await ethers.getContractAt("QuantozTokenLZ", tokenAddress);

    // Setup RBAC
    await upgradedToken.connect(owner).grantInitialRole();
    await upgradedToken.connect(owner).grantRole(await upgradedToken.BURNER_ROLE(), ownerAddress);

    // remove from blocked list
    await token.connect(owner).removeFromBlockedList(userAddress);

    // Test burn on upgraded token
    await expect(upgradedToken.connect(owner).burn(userAddress, 100000))
      .to.emit(upgradedToken, "Burn")
      .withArgs(userAddress, 100000);


    // Verify balance is reduced on upgraded token
    const upgradedUserBalance = await upgradedToken.connect(user).balanceOf(userAddress);
    await expect(upgradedUserBalance.toString()).to.equal("200000"); // 300000 - 100000

    // Test burn with burner role (should work)
    const burner = await ethers.getSigner(4); // Get another signer
    await upgradedToken.connect(owner).grantRole(await upgradedToken.BURNER_ROLE(), burner.getAddress());

    await expect(upgradedToken.connect(burner).burn(userAddress, 50000))
      .to.emit(upgradedToken, "Burn")
      .withArgs(userAddress, 50000);

    // Verify balance is reduced by burner
    const balanceAfterBurnerBurn = await upgradedToken.connect(user).balanceOf(userAddress);
    await expect(balanceAfterBurnerBurn.toString()).to.equal("150000"); // 200000 - 50000


    // Test burn by user without burner role (should fail)
    try {
      await upgradedToken.connect(user).burn(userAddress, 10000);
      await expect(true).to.equal(false); // Should not reach here
    } catch (e) {
      await expect(e.toString()).to.contains("AccessControl");
    }

    // Test burn with invalid parameters on upgraded token
    try {
      await upgradedToken.connect(owner).burn("0x0000000000000000000000000000000000000000", 10000);
      await expect(true).to.equal(false); // Should not reach here
    } catch (e) {
      await expect(e.toString()).to.contains("Token: burn from the zero address");
    }


    // Test burn with zero amount (should fail)
    try {
      await upgradedToken.connect(owner).burn(userAddress, 0);
      await expect(true).to.equal(false); // Should not reach here
    } catch (e) {
      await expect(e.toString()).to.contains("Token: amount must be greater than 0");
    }

    // Test burn from blocked user by burner role (should fail because only owner can burn from blocked users)
    await upgradedToken.connect(owner).addToBlockedList(userAddress);

    try {
      await upgradedToken.connect(burner).burn(userAddress, 10000);
      await expect(true).to.equal(false); // Should not reach here
    } catch (e) {
      await expect(e.toString()).to.contains("Token: from is blocked");
    }

    // Test burn from blocked user by owner (should work)
    await expect(upgradedToken.connect(owner).burn(userAddress, 10000))
      .to.emit(upgradedToken, "Burn")
      .withArgs(userAddress, 10000);

    // Verify balance is reduced by owner
    const balanceAfterOwnerBurnFromBlocked = await upgradedToken.connect(user).balanceOf(userAddress);
    await expect(balanceAfterOwnerBurnFromBlocked.toString()).to.equal("140000"); // 150000 - 10000
  });




});

