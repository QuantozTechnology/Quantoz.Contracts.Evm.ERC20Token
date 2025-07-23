// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "forge-std/Test.sol";
import "../contracts/tokens/QuantozToken.sol";
import "../contracts/hadron/factories/Factory.sol";
import "../test/utils/SigUtils.sol";
import "../test/utils/TestUtils.sol";

contract QuantozTokenFuzzTest is Test, TestUtils {
    uint256 internal constant ownerPrivateKey = 0x3418d;
    uint256 internal constant minterPrivateKey = 0xd2c06;
    uint256 internal constant burnerPrivateKey = 0x12345;
    uint256 internal constant userPrivateKey = 0x67890;

    address internal owner;
    address internal minter;
    address internal burner;
    address internal user;

    QuantozTokenLZ internal _token;
    address internal _tokenImplementation;
    Factory internal _factory;
    SigUtils internal _sigUtils;

    function setUp() public virtual {
        owner = vm.addr(ownerPrivateKey);
        minter = vm.addr(minterPrivateKey);
        burner = vm.addr(burnerPrivateKey);
        user = vm.addr(userPrivateKey);

        _factory = new Factory();
        _tokenImplementation = address(new QuantozTokenLZ());

        bytes memory _data = abi.encodeWithSignature(
            "initialize(string,string,uint8)",
            "QuantozToken",
            "QNTZ",
            6
        );

        _token = QuantozTokenLZ(
            _factory.deployClone(_tokenImplementation, owner, _data)
        );

        // Grant initial roles to owner
        vm.prank(owner);
        _token.grantInitialRole();

        // Try to initialize the token again
        vm.expectRevert("Initializable: contract is already initialized");
        _token.initialize("AnotherName", "ERR", 6);

        _sigUtils = new SigUtils(_token.DOMAIN_SEPARATOR());
    }

    // ============ METADATA TESTS ============

    function testFuzz_metadata(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) public {
        vm.assume(bytes(name_).length > 0 && bytes(symbol_).length > 0);
        vm.assume(decimals_ <= 18);

        bytes memory _data = abi.encodeWithSignature(
            "initialize(string,string,uint8)",
            name_,
            symbol_,
            decimals_
        );

        QuantozTokenLZ mockToken = QuantozTokenLZ(
            _factory.deployClone(_tokenImplementation, owner, _data)
        );

        assertEq(mockToken.name(), name_);
        assertEq(mockToken.symbol(), symbol_);
        assertEq(mockToken.decimals(), decimals_);
    }

    function test_invariant_metadataIsConstant() public {
        assertEq(_token.name(), "QuantozToken");
        assertEq(_token.symbol(), "QNTZ");
        assertEq(_token.decimals(), 6);
    }

    // ============ MINTING TESTS ============

    function testFuzz_mint(address account_, uint256 amount_) public {
        vm.assume(account_ != address(_token) && account_ != address(0));
        vm.assume(amount_ > 0);

        uint256 preSupply = _token.totalSupply();
        uint256 preBalance = _token.balanceOf(account_);

        vm.prank(owner);
        _token.mint(account_, amount_);

        assertEq(_token.totalSupply(), preSupply + amount_);
        assertEq(_token.balanceOf(account_), preBalance + amount_);
    }

    function testFuzz_mint_unauthorized(address account_, uint256 amount_) public {
        vm.assume(account_ != address(_token) && account_ != address(0));
        vm.assume(amount_ > 0);

        vm.prank(user);
        vm.expectRevert();
        _token.mint(account_, amount_);
    }

    function testFuzz_mint_zeroAddress(uint256 amount_) public {
        vm.assume(amount_ > 0);

        vm.prank(owner);
        vm.expectRevert("Token: mint to the zero address");
        _token.mint(address(0), amount_);
    }

    function testFuzz_mint_zeroAmount(address account_) public {
        vm.assume(account_ != address(_token) && account_ != address(0));

        vm.prank(owner);
        vm.expectRevert("Token: amount must be greater than 0");
        _token.mint(account_, 0);
    }

    // ============ BURNING TESTS ============

    function testFuzz_burn(address account_, uint256 amount_) public {
        vm.assume(account_ != address(_token) && account_ != address(0));
        vm.assume(amount_ > 0);

        // First mint tokens to the account
        vm.prank(owner);
        _token.mint(account_, amount_);

        uint256 preSupply = _token.totalSupply();
        uint256 preBalance = _token.balanceOf(account_);

        vm.prank(owner);
        _token.burn(account_, amount_);

        assertEq(_token.totalSupply(), preSupply - amount_);
        assertEq(_token.balanceOf(account_), preBalance - amount_);
    }

    function testFuzz_burn_unauthorized(address account_, uint256 amount_) public {
        vm.assume(account_ != address(_token) && account_ != address(0));
        vm.assume(amount_ > 0);

        vm.prank(user);
        vm.expectRevert();
        _token.burn(account_, amount_);
    }

    function testFuzz_burn_zeroAddress(uint256 amount_) public {
        vm.assume(amount_ > 0);

        vm.prank(owner);
        vm.expectRevert("Token: burn from the zero address");
        _token.burn(address(0), amount_);
    }

    function testFuzz_burn_zeroAmount(address account_) public {
        vm.assume(account_ != address(_token) && account_ != address(0));

        vm.prank(owner);
        vm.expectRevert("Token: amount must be greater than 0");
        _token.burn(account_, 0);
    }

    // ============ TRANSFER TESTS ============

    function testFuzz_transfer(address recipient_, uint256 amount_) public {
        vm.assume(recipient_ != address(_token) && recipient_ != address(0));
        vm.assume(amount_ > 0);

        // Mint tokens to msg.sender (the test contract)
        vm.prank(owner);
        _token.mint(address(this), amount_);

        uint256 preSenderBalance = _token.balanceOf(address(this));
        uint256 preRecipientBalance = _token.balanceOf(recipient_);
        uint256 preSupply = _token.totalSupply();

        assertTrue(_token.transfer(recipient_, amount_));

        assertEq(_token.balanceOf(address(this)), preSenderBalance - amount_);
        assertEq(_token.balanceOf(recipient_), preRecipientBalance + amount_);
        assertEq(_token.totalSupply(), preSupply);
    }

    function testFuzz_transfer_insufficientBalance(
        address recipient_,
        uint256 mintAmount_,
        uint256 transferAmount_
    ) public {
        vm.assume(recipient_ != address(_token) && recipient_ != address(0));
        vm.assume(mintAmount_ > 0 && transferAmount_ > mintAmount_);

        // Mint less than transfer amount
        vm.prank(owner);
        _token.mint(owner, mintAmount_);

        vm.prank(owner);
        vm.expectRevert("ERC20: transfer amount exceeds balance");
        _token.transfer(recipient_, transferAmount_);
    }

    function testFuzz_transfer_toContract() public {
        vm.prank(owner);
        _token.mint(owner, 1000);

        vm.prank(owner);
        vm.expectRevert("Token: transfer to the contract address");
        _token.transfer(address(_token), 100);
    }

    // ============ TRANSFERFROM TESTS ============

    function testFuzz_transferFrom(
        address spender_,
        address recipient_,
        uint256 approval_,
        uint256 amount_
    ) public {
        vm.assume(spender_ != address(_token) && recipient_ != address(_token));
        vm.assume(spender_ != address(0) && recipient_ != address(0));
        vm.assume(spender_ != owner && recipient_ != owner);
        vm.assume(approval_ > 0 && amount_ > 0 && amount_ <= approval_);
        
        // Constrain values to prevent overflow
        vm.assume(approval_ <= type(uint256).max / 2);
        vm.assume(amount_ <= type(uint256).max / 2);

        // Mint tokens to owner
        vm.prank(owner);
        _token.mint(owner, amount_);

        // Reset allowance first
        vm.prank(owner);
        _token.approve(spender_, 0);

        // Approve spender
        vm.prank(owner);
        _token.approve(spender_, approval_);

        uint256 preOwnerBalance = _token.balanceOf(owner);
        uint256 preRecipientBalance = _token.balanceOf(recipient_);
        uint256 preSupply = _token.totalSupply();

        vm.prank(spender_);
        assertTrue(_token.transferFrom(owner, recipient_, amount_));

        assertEq(_token.balanceOf(owner), preOwnerBalance - amount_);
        assertEq(_token.balanceOf(recipient_), preRecipientBalance + amount_);
        assertEq(_token.totalSupply(), preSupply);
        assertEq(_token.allowance(owner, spender_), approval_ - amount_);
    }

    function testFuzz_transferFrom_infiniteApproval(
        address spender_,
        address recipient_,
        uint256 amount_
    ) public {
        vm.assume(spender_ != address(_token) && recipient_ != address(_token));
        vm.assume(spender_ != address(0) && recipient_ != address(0));
        vm.assume(spender_ != owner && recipient_ != owner);
        vm.assume(amount_ > 0);

        // Mint tokens to owner
        vm.prank(owner);
        _token.mint(owner, amount_);

        // Approve infinite amount
        vm.prank(owner);
        _token.approve(spender_, type(uint256).max);

        vm.prank(spender_);
        assertTrue(_token.transferFrom(owner, recipient_, amount_));

        // Allowance should remain infinite
        assertEq(_token.allowance(owner, spender_), type(uint256).max);
    }

    function testFuzz_transferFrom_insufficientAllowance(
        address spender_,
        address recipient_,
        uint256 approval_,
        uint256 amount_
    ) public {
        vm.assume(spender_ != address(_token) && recipient_ != address(_token));
        vm.assume(spender_ != address(0) && recipient_ != address(0));
        vm.assume(spender_ != owner && recipient_ != owner);
        vm.assume(approval_ > 0 && amount_ > approval_);

        // Mint tokens to owner
        vm.prank(owner);
        _token.mint(owner, amount_);

        // Approve less than transfer amount
        vm.prank(owner);
        _token.approve(spender_, approval_);

        vm.prank(spender_);
        vm.expectRevert("ERC20: insufficient allowance");
        _token.transferFrom(owner, recipient_, amount_);
    }

    // ============ APPROVAL TESTS ============

    function testFuzz_approve(address spender_, uint256 amount_) public {
        vm.assume(spender_ != address(0) && spender_ != address(_token));

        // Reset allowance to ensure clean state
        vm.prank(owner);
        _token.approve(spender_, 0);

        assertEq(_token.allowance(owner, spender_), 0);

        vm.prank(owner);
        assertTrue(_token.approve(spender_, amount_));

        assertEq(_token.allowance(owner, spender_), amount_);
    }

    function testFuzz_increaseAllowance(
        address spender_,
        uint256 initialAmount_,
        uint256 addedAmount_
    ) public {
        vm.assume(spender_ != address(0));

        // Constrain values to prevent overflow
        initialAmount_ = constrictToRange(initialAmount_, 0, type(uint256).max / 2);
        addedAmount_ = constrictToRange(addedAmount_, 0, type(uint256).max / 2);
        
        // Ensure no overflow in addition
        vm.assume(initialAmount_ <= type(uint256).max - addedAmount_);

        // Reset allowance first
        vm.prank(owner);
        _token.approve(spender_, 0);

        // Set initial allowance
        vm.prank(owner);
        _token.approve(spender_, initialAmount_);

        assertEq(_token.allowance(owner, spender_), initialAmount_);

        vm.prank(owner);
        assertTrue(_token.increaseAllowance(spender_, addedAmount_));

        assertEq(_token.allowance(owner, spender_), initialAmount_ + addedAmount_);
    }

    function testFuzz_decreaseAllowance(
        address spender_,
        uint256 initialAmount_,
        uint256 subtractedAmount_
    ) public {
        vm.assume(spender_ != address(0) && spender_ != address(_token));

        // Constrain values to prevent underflow
        initialAmount_ = constrictToRange(initialAmount_, 0, type(uint256).max - 1);
        subtractedAmount_ = constrictToRange(subtractedAmount_, 0, initialAmount_);

        // Reset allowance first
        vm.prank(owner);
        _token.approve(spender_, 0);

        // Set initial allowance
        vm.prank(owner);
        _token.approve(spender_, initialAmount_);

        assertEq(_token.allowance(owner, spender_), initialAmount_);

        vm.prank(owner);
        assertTrue(_token.decreaseAllowance(spender_, subtractedAmount_));

        assertEq(_token.allowance(owner, spender_), initialAmount_ - subtractedAmount_);
    }

    // ============ PERMIT TESTS ============

    // Deterministic test for permit using a known keypair
    function test_permit_deterministic() public {
        // Use a known private key and derive the address
        uint256 privateKey = 0xA11CE;
        address owner_ = vm.addr(privateKey);
        address spender_ = address(0xBEEF);
        uint256 value_ = 12345;
        uint256 deadline_ = block.timestamp + 1 days;

        SigUtils.Permit memory permit = SigUtils.Permit({
            owner: owner_,
            spender: spender_,
            value: value_,
            nonce: _token.nonces(owner_),
            deadline: deadline_
        });

        bytes32 digest = _sigUtils.getTypedDataHash(permit);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);

        // Fund the owner with tokens so the permit is meaningful
        vm.prank(owner);
        _token.mint(owner_, value_);

        vm.prank(owner_);
        _token.permit(owner_, spender_, value_, deadline_, v, r, s);

        assertEq(_token.allowance(owner_, spender_), value_);
    }

    // Deterministic test for permit with expired deadline
    function test_permit_expired_deterministic() public {
        uint256 privateKey = 0xA11CE;
        address owner_ = vm.addr(privateKey);
        address spender_ = address(0xBEEF);
        uint256 value_ = 12345;
        uint256 deadline_ = block.timestamp - 1; // Expired

        SigUtils.Permit memory permit = SigUtils.Permit({
            owner: owner_,
            spender: spender_,
            value: value_,
            nonce: _token.nonces(owner_),
            deadline: deadline_
        });

        bytes32 digest = _sigUtils.getTypedDataHash(permit);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);

        // Fund the owner with tokens so the permit is meaningful
        vm.prank(owner);
        _token.mint(owner_, value_);

        vm.prank(owner_);
        vm.expectRevert("ERC20Permit: expired deadline");
        _token.permit(owner_, spender_, value_, deadline_, v, r, s);
    }

    // ============ BLOCKED LIST TESTS ============

    function testFuzz_blockedList(address user_) public {
        vm.assume(user_ != address(0) && user_ != address(_token));

        // Initially not blocked
        assertFalse(_token.isBlocked(user_));

        // Add to blocked list
        vm.prank(owner);
        _token.addToBlockedList(user_);

        assertTrue(_token.isBlocked(user_));

        // Remove from blocked list
        vm.prank(owner);
        _token.removeFromBlockedList(user_);

        assertFalse(_token.isBlocked(user_));
    }

    function testFuzz_blockedList_unauthorized(address user_) public {
        vm.assume(user_ != address(0) && user_ != address(_token));

        vm.prank(user);
        vm.expectRevert("Ownable: caller is not the owner");
        _token.addToBlockedList(user_);

        vm.prank(user);
        vm.expectRevert("Ownable: caller is not the owner");
        _token.removeFromBlockedList(user_);
    }

    function testFuzz_blockedList_zeroAddress() public {
        vm.prank(owner);
        vm.expectRevert("Blocked: cannot block zero address");
        _token.addToBlockedList(address(0));

        vm.prank(owner);
        vm.expectRevert("Blocked: cannot block zero address");
        _token.removeFromBlockedList(address(0));
    }

    function testFuzz_transfer_blockedSender(
        address blockedUser_,
        address recipient_,
        uint256 amount_
    ) public {
        vm.assume(blockedUser_ != address(_token) && recipient_ != address(_token));
        vm.assume(blockedUser_ != address(0) && recipient_ != address(0));
        vm.assume(blockedUser_ != owner && recipient_ != owner);
        vm.assume(amount_ > 0);
        
        // Constrain amount to prevent overflow
        vm.assume(amount_ <= type(uint256).max / 2);

        // Mint tokens to blocked user
        vm.prank(owner);
        _token.mint(blockedUser_, amount_);

        // Block the user
        vm.prank(owner);
        _token.addToBlockedList(blockedUser_);

        // Try to transfer from blocked user
        vm.prank(blockedUser_);
        vm.expectRevert("Token: from is blocked");
        _token.transfer(recipient_, amount_);

        // Note: The owner cannot transferFrom blocked users due to the onlyNotBlocked modifier
        // This is a design limitation of the current contract implementation
    }

    function testFuzz_transferFrom_blockedSpender(
        address spender_,
        address recipient_,
        uint256 amount_
    ) public {
        vm.assume(spender_ != address(_token) && recipient_ != address(_token));
        vm.assume(spender_ != address(0) && recipient_ != address(0));
        vm.assume(spender_ != owner && recipient_ != owner);
        vm.assume(amount_ > 0);

        // Mint tokens to owner
        vm.prank(owner);
        _token.mint(owner, amount_);

        // Approve spender
        vm.prank(owner);
        _token.approve(spender_, amount_);

        // Block the spender
        vm.prank(owner);
        _token.addToBlockedList(spender_);

        // Try to transferFrom with blocked spender
        vm.prank(spender_);
        vm.expectRevert("Blocked: msg.sender is blocked");
        _token.transferFrom(owner, recipient_, amount_);
    }

    // ============ INVARIANT TESTS ============

    function testInvariant_mintingAffectsTotalSupplyAndBalance(
        address to,
        uint256 amount
    ) public {
        vm.assume(to != address(_token));
        vm.assume(to != address(0));
        vm.assume(amount > 0);

        uint256 preSupply = _token.totalSupply();

        vm.prank(owner);
        _token.mint(to, amount);

        uint256 postSupply = _token.totalSupply();
        uint256 toBalance = _token.balanceOf(to);

        assertEq(
            postSupply,
            preSupply + amount,
            "Total supply did not increase correctly after minting"
        );

        assertEq(
            toBalance,
            amount,
            "Recipient balance incorrect after minting"
        );
    }

    function testInvariant_transferCorrectlyUpdatesBalances(
        address sender,
        address receiver,
        uint256 mintAmount,
        uint256 transferAmount
    ) public {
        vm.assume(sender != address(_token) && receiver != address(_token));
        vm.assume(sender != address(0) && receiver != address(0) && sender != receiver);
        vm.assume(mintAmount > 0 && transferAmount > 0 && mintAmount >= transferAmount);

        vm.prank(owner);
        _token.mint(sender, mintAmount);

        uint256 initialSenderBalance = _token.balanceOf(sender);
        uint256 initialReceiverBalance = _token.balanceOf(receiver);
        uint256 initialTotalSupply = _token.totalSupply();

        vm.prank(sender);
        _token.transfer(receiver, transferAmount);

        uint256 expectedSenderBalance = initialSenderBalance - transferAmount;
        uint256 expectedReceiverBalance = initialReceiverBalance + transferAmount;

        assertEq(
            _token.balanceOf(sender),
            expectedSenderBalance,
            "Sender balance incorrect after transfer"
        );

        assertEq(
            _token.balanceOf(receiver),
            expectedReceiverBalance,
            "Receiver balance incorrect after transfer"
        );

        assertEq(
            _token.totalSupply(),
            initialTotalSupply,
            "Total supply should remain constant after transfers"
        );
    }

    function testInvariant_burningAffectsTotalSupplyAndBalance(
        address account,
        uint256 mintAmount,
        uint256 burnAmount
    ) public {
        vm.assume(account != address(_token));
        vm.assume(account != address(0));
        vm.assume(mintAmount > 0 && burnAmount > 0 && mintAmount >= burnAmount);

        vm.prank(owner);
        _token.mint(account, mintAmount);

        uint256 preSupply = _token.totalSupply();
        uint256 preBalance = _token.balanceOf(account);

        vm.prank(owner);
        _token.burn(account, burnAmount);

        uint256 postSupply = _token.totalSupply();
        uint256 postBalance = _token.balanceOf(account);

        assertEq(
            postSupply,
            preSupply - burnAmount,
            "Total supply did not decrease correctly after burning"
        );

        assertEq(
            postBalance,
            preBalance - burnAmount,
            "Account balance incorrect after burning"
        );
    }

    function testInvariant_allowanceDecreasesOnTransferFrom(
        address spender,
        address recipient,
        uint256 approval,
        uint256 transferAmount
    ) public {
        vm.assume(spender != address(_token) && recipient != address(_token));
        vm.assume(spender != address(0) && recipient != address(0));
        vm.assume(spender != owner && recipient != owner);
        vm.assume(approval > 0 && transferAmount > 0 && transferAmount <= approval);
        
        // Constrain values to prevent overflow
        vm.assume(approval <= type(uint256).max / 2);
        vm.assume(transferAmount <= type(uint256).max / 2);

        vm.prank(owner);
        _token.mint(owner, transferAmount);

        // Reset allowance first
        vm.prank(owner);
        _token.approve(spender, 0);

        vm.prank(owner);
        _token.approve(spender, approval);

        uint256 preAllowance = _token.allowance(owner, spender);

        vm.prank(spender);
        _token.transferFrom(owner, recipient, transferAmount);

        uint256 postAllowance = _token.allowance(owner, spender);

        assertEq(
            postAllowance,
            preAllowance - transferAmount,
            "Allowance did not decrease correctly after transferFrom"
        );
    }

    function testInvariant_allowanceUnchangedOnInfiniteApproval(
        address spender,
        address recipient,
        uint256 transferAmount
    ) public {
        vm.assume(spender != address(_token) && recipient != address(_token));
        vm.assume(spender != address(0) && recipient != address(0));
        vm.assume(spender != owner && recipient != owner);
        vm.assume(transferAmount > 0);

        vm.prank(owner);
        _token.mint(owner, transferAmount);

        vm.prank(owner);
        _token.approve(spender, type(uint256).max);

        uint256 preAllowance = _token.allowance(owner, spender);

        vm.prank(spender);
        _token.transferFrom(owner, recipient, transferAmount);

        uint256 postAllowance = _token.allowance(owner, spender);

        assertEq(
            postAllowance,
            preAllowance,
            "Infinite allowance should remain unchanged after transferFrom"
        );
    }

    // Deterministic test for role management
    function test_roles_deterministic() public {
        uint256 minterPk = 0xA11CE;
        uint256 burnerPk = 0xB0B;
        address newMinter = vm.addr(minterPk);
        address newBurner = vm.addr(burnerPk);

        // Initially owner has all roles
        vm.startPrank(owner);
        assertTrue(_token.hasRole(_token.DEFAULT_ADMIN_ROLE(), owner));
        assertTrue(_token.hasRole(_token.MINTER_ROLE(), owner));
        assertTrue(_token.hasRole(_token.BURNER_ROLE(), owner));
        _token.grantRole(_token.MINTER_ROLE(), newMinter);
        _token.grantRole(_token.BURNER_ROLE(), newBurner);
        vm.stopPrank();

        vm.startPrank(newMinter);
        assertTrue(_token.hasRole(_token.MINTER_ROLE(), newMinter));
        _token.mint(newMinter, 1000);
        assertEq(_token.balanceOf(newMinter), 1000);
        vm.stopPrank();

        vm.startPrank(newBurner);
        assertTrue(_token.hasRole(_token.BURNER_ROLE(), newBurner));
        _token.burn(newMinter, 500);
        assertEq(_token.balanceOf(newMinter), 500);
        vm.stopPrank();
    }

    // Deterministic test for role revocation
    function test_revokeRoles_deterministic() public {
        uint256 minterPk = 0xA11CE;
        uint256 burnerPk = 0xB0B;
        address newMinter = vm.addr(minterPk);
        address newBurner = vm.addr(burnerPk);

        // Grant roles (owner calls these)
        vm.startPrank(owner);
        _token.grantRole(_token.MINTER_ROLE(), newMinter);
        _token.grantRole(_token.BURNER_ROLE(), newBurner);
        _token.revokeRole(_token.MINTER_ROLE(), newMinter);
        _token.revokeRole(_token.BURNER_ROLE(), newBurner);
        vm.stopPrank();

        vm.startPrank(newMinter);
        assertFalse(_token.hasRole(_token.MINTER_ROLE(), newMinter));
        vm.expectRevert();
        _token.mint(newMinter, 1000);
        vm.stopPrank();

        vm.startPrank(newBurner);
        assertFalse(_token.hasRole(_token.BURNER_ROLE(), newBurner));
        vm.expectRevert();
        _token.burn(newMinter, 500);
        vm.stopPrank();
    }
} 