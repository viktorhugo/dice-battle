// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, Vm} from "forge-std/Test.sol";
import {DiceBattle} from "../src/DiceBattle.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DiceBattleTest is Test {
    DiceBattle internal game;
    MockERC20 internal cUsd;
    MockERC20 internal usdt;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    uint128 internal constant STAKE = 1 ether;
    uint256 internal constant FEE_BPS = 200; // 2%

    bytes32 internal constant SECRET = bytes32(uint256(0x1111));

    event RoomCreated(
        uint256 indexed roomId,
        address indexed playerA,
        address indexed token,
        uint256 stake,
        bytes32 commitment
    );
    event RoomResolved(
        uint256 indexed roomId,
        address indexed winner,
        uint8 rollA,
        uint8 rollB,
        uint256 payout,
        uint256 fee
    );

    function setUp() public {
        vm.prank(owner);
        game = new DiceBattle(FEE_BPS);

        cUsd = new MockERC20("Celo Dollar", "cUSD", 18);
        usdt = new MockERC20("Tether", "USDT", 18);

        vm.startPrank(owner);
        game.setTokenAllowed(address(cUsd), true);
        game.setTokenAllowed(address(usdt), true);
        vm.stopPrank();

        address[3] memory users = [alice, bob, carol];
        for (uint256 i; i < users.length; i++) {
            cUsd.mint(users[i], 1_000 ether);
            usdt.mint(users[i], 1_000 ether);
            vm.prank(users[i]);
            cUsd.approve(address(game), type(uint256).max);
            vm.prank(users[i]);
            usdt.approve(address(game), type(uint256).max);
        }
    }

    // ============================================================
    //                      HELPERS
    // ============================================================

    function _commit(bytes32 secret, address player) internal pure returns (bytes32) {
        return keccak256(abi.encode(secret, player));
    }

    function _playFullGame(bytes32 secret) internal returns (uint256 roomId) {
        bytes32 commitment = _commit(secret, alice);

        vm.prank(alice);
        roomId = game.createRoom(IERC20(address(cUsd)), STAKE, commitment);

        vm.prank(bob);
        game.joinRoom(roomId);

        vm.prank(alice);
        game.reveal(roomId, secret);
    }

    // ============================================================
    //                      createRoom
    // ============================================================

    function test_createRoom_escrowsStake() public {
        bytes32 commitment = _commit(SECRET, alice);
        uint256 balBefore = cUsd.balanceOf(alice);

        vm.expectEmit(true, true, true, true);
        emit RoomCreated(0, alice, address(cUsd), STAKE, commitment);

        vm.prank(alice);
        uint256 roomId = game.createRoom(IERC20(address(cUsd)), STAKE, commitment);

        assertEq(roomId, 0);
        assertEq(cUsd.balanceOf(alice), balBefore - STAKE);
        assertEq(cUsd.balanceOf(address(game)), STAKE);
    }

    function test_createRoom_revertsOnDisallowedToken() public {
        MockERC20 rogue = new MockERC20("Rogue", "RGE", 18);
        bytes32 commitment = _commit(SECRET, alice);

        vm.prank(alice);
        vm.expectRevert(DiceBattle.TokenNotAllowed.selector);
        game.createRoom(IERC20(address(rogue)), STAKE, commitment);
    }

    function test_createRoom_revertsOnZeroStake() public {
        bytes32 commitment = _commit(SECRET, alice);
        vm.prank(alice);
        vm.expectRevert(DiceBattle.StakeTooLow.selector);
        game.createRoom(IERC20(address(cUsd)), 0, commitment);
    }

    // ============================================================
    //                      joinRoom
    // ============================================================

    function test_joinRoom_transitionsToMatched() public {
        bytes32 commitment = _commit(SECRET, alice);
        vm.prank(alice);
        uint256 roomId = game.createRoom(IERC20(address(cUsd)), STAKE, commitment);

        vm.prank(bob);
        game.joinRoom(roomId);

        (
            address playerA,
            address playerB,
            ,
            uint128 stake,
            ,
            ,
            DiceBattle.RoomState state
        ) = game.rooms(roomId);

        assertEq(playerA, alice);
        assertEq(playerB, bob);
        assertEq(stake, STAKE);
        assertEq(uint8(state), uint8(DiceBattle.RoomState.Matched));
    }

    function test_joinRoom_revertsIfPlayerAJoinsOwnRoom() public {
        bytes32 commitment = _commit(SECRET, alice);
        vm.prank(alice);
        uint256 roomId = game.createRoom(IERC20(address(cUsd)), STAKE, commitment);

        vm.prank(alice);
        vm.expectRevert(DiceBattle.SameAsPlayerA.selector);
        game.joinRoom(roomId);
    }

    function test_joinRoom_revertsIfAlreadyMatched() public {
        bytes32 commitment = _commit(SECRET, alice);
        vm.prank(alice);
        uint256 roomId = game.createRoom(IERC20(address(cUsd)), STAKE, commitment);

        vm.prank(bob);
        game.joinRoom(roomId);

        vm.prank(carol);
        vm.expectRevert(DiceBattle.RoomNotOpen.selector);
        game.joinRoom(roomId);
    }

    // ============================================================
    //                      reveal
    // ============================================================

    function test_reveal_settlesWithCorrectPayout() public {
        uint256 aliceBefore = cUsd.balanceOf(alice);
        uint256 bobBefore = cUsd.balanceOf(bob);

        uint256 roomId = _playFullGame(SECRET);

        uint256 pot = uint256(STAKE) * 2;
        uint256 fee = (pot * FEE_BPS) / 10_000;
        uint256 payout = pot - fee;

        uint256 aliceAfter = cUsd.balanceOf(alice);
        uint256 bobAfter = cUsd.balanceOf(bob);

        // forge-lint: disable-next-line(unsafe-typecast)
        int256 aliceDelta = int256(aliceAfter) - int256(aliceBefore);
        // forge-lint: disable-next-line(unsafe-typecast)
        int256 bobDelta = int256(bobAfter) - int256(bobBefore);

        // Exactly one of three outcomes must hold
        // forge-lint: disable-next-line(unsafe-typecast)
        bool aliceWon = aliceDelta == int256(payout - STAKE) && bobDelta == -int256(uint256(STAKE));
        // forge-lint: disable-next-line(unsafe-typecast)
        bool bobWon = bobDelta == int256(payout - STAKE) && aliceDelta == -int256(uint256(STAKE));
        bool tied = aliceDelta == 0 && bobDelta == 0;

        assertTrue(aliceWon || bobWon || tied, "invalid settlement");

        if (!tied) {
            assertEq(game.accruedFees(address(cUsd)), fee);
        } else {
            assertEq(game.accruedFees(address(cUsd)), 0);
        }

        // Contract must hold zero balance after settlement
        assertEq(cUsd.balanceOf(address(game)), tied ? 0 : fee);

        roomId; // silence unused warning
    }

    function test_reveal_revertsOnInvalidSecret() public {
        bytes32 commitment = _commit(SECRET, alice);
        vm.prank(alice);
        uint256 roomId = game.createRoom(IERC20(address(cUsd)), STAKE, commitment);
        vm.prank(bob);
        game.joinRoom(roomId);

        vm.prank(alice);
        vm.expectRevert(DiceBattle.InvalidReveal.selector);
        game.reveal(roomId, bytes32(uint256(0xDEAD)));
    }

    function test_reveal_revertsIfCalledByNonPlayerA() public {
        bytes32 commitment = _commit(SECRET, alice);
        vm.prank(alice);
        uint256 roomId = game.createRoom(IERC20(address(cUsd)), STAKE, commitment);
        vm.prank(bob);
        game.joinRoom(roomId);

        vm.prank(bob);
        vm.expectRevert(DiceBattle.NotPlayerA.selector);
        game.reveal(roomId, SECRET);
    }

    // ============================================================
    //                      claimExpired
    // ============================================================

    function test_claimExpired_allowsBobToWinAfterWindow() public {
        bytes32 commitment = _commit(SECRET, alice);
        vm.prank(alice);
        uint256 roomId = game.createRoom(IERC20(address(cUsd)), STAKE, commitment);
        vm.prank(bob);
        game.joinRoom(roomId);

        // Advance past the reveal window
        vm.roll(block.number + 201);

        uint256 balBefore = cUsd.balanceOf(bob);
        vm.prank(bob);
        game.claimExpired(roomId);

        uint256 pot = uint256(STAKE) * 2;
        uint256 fee = (pot * FEE_BPS) / 10_000;
        assertEq(cUsd.balanceOf(bob) - balBefore, pot - fee);
    }

    function test_claimExpired_revertsBeforeWindow() public {
        bytes32 commitment = _commit(SECRET, alice);
        vm.prank(alice);
        uint256 roomId = game.createRoom(IERC20(address(cUsd)), STAKE, commitment);
        vm.prank(bob);
        game.joinRoom(roomId);

        vm.prank(bob);
        vm.expectRevert(DiceBattle.RevealWindowActive.selector);
        game.claimExpired(roomId);
    }

    // ============================================================
    //                      cancelRoom
    // ============================================================

    function test_cancelRoom_refundsAlice() public {
        bytes32 commitment = _commit(SECRET, alice);
        uint256 balBefore = cUsd.balanceOf(alice);

        vm.prank(alice);
        uint256 roomId = game.createRoom(IERC20(address(cUsd)), STAKE, commitment);
        vm.prank(alice);
        game.cancelRoom(roomId);

        assertEq(cUsd.balanceOf(alice), balBefore);
    }

    // ============================================================
    //                      ADMIN
    // ============================================================

    function test_setFeeBps_revertsAboveMax() public {
        vm.prank(owner);
        vm.expectRevert(DiceBattle.FeeTooHigh.selector);
        game.setFeeBps(501);
    }

    function test_withdrawFees_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        game.withdrawFees(address(cUsd), alice);
    }

    // ============================================================
    //                      FUZZ TESTS
    // ============================================================

    /// @dev Fuzz: any valid secret produces a settlement where contract ends up
    ///           with exactly `fee` (or 0 if tied) and no tokens leak.
    function testFuzz_reveal_noTokensLeak(bytes32 secret) public {
        bytes32 commitment = _commit(secret, alice);
        vm.prank(alice);
        uint256 roomId = game.createRoom(IERC20(address(cUsd)), STAKE, commitment);
        vm.prank(bob);
        game.joinRoom(roomId);
        vm.prank(alice);
        game.reveal(roomId, secret);

        uint256 held = cUsd.balanceOf(address(game));
        uint256 accrued = game.accruedFees(address(cUsd));

        // The only reason the contract holds tokens is accrued fees
        assertEq(held, accrued);
    }

    /// @dev Fuzz: rolls derived must always be 1-6 inclusive across many secrets.
    function testFuzz_rolls_inDiceRange(bytes32 secret, uint256 prevrandao) public {
        vm.prevrandao(prevrandao);

        bytes32 commitment = _commit(secret, alice);
        vm.prank(alice);
        uint256 roomId = game.createRoom(IERC20(address(cUsd)), STAKE, commitment);
        vm.prank(bob);
        game.joinRoom(roomId);

        vm.recordLogs();
        vm.prank(alice);
        game.reveal(roomId, secret);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        // Find either RoomResolved or RoomTied
        bytes32 resolvedSig = keccak256("RoomResolved(uint256,address,uint8,uint8,uint256,uint256)");
        bytes32 tiedSig = keccak256("RoomTied(uint256,uint8,uint8)");

        for (uint256 i; i < logs.length; i++) {
            if (logs[i].topics[0] == resolvedSig) {
                (uint8 rollA, uint8 rollB,,) = abi.decode(logs[i].data, (uint8, uint8, uint256, uint256));
                assertGe(rollA, 1); assertLe(rollA, 6);
                assertGe(rollB, 1); assertLe(rollB, 6);
                return;
            }
            if (logs[i].topics[0] == tiedSig) {
                (uint8 rollA, uint8 rollB) = abi.decode(logs[i].data, (uint8, uint8));
                assertGe(rollA, 1); assertLe(rollA, 6);
                assertGe(rollB, 1); assertLe(rollB, 6);
                assertEq(rollA, rollB);
                return;
            }
        }
        revert("no settlement event found");
    }

    /// @dev Fuzz: fee math holds for any stake.
    function testFuzz_feeMath(uint128 stake) public {
        stake = uint128(bound(stake, 1, 1_000_000 ether));

        // Top up alice + bob
        cUsd.mint(alice, stake);
        cUsd.mint(bob, stake);

        bytes32 commitment = _commit(SECRET, alice);
        vm.prank(alice);
        uint256 roomId = game.createRoom(IERC20(address(cUsd)), stake, commitment);
        vm.prank(bob);
        game.joinRoom(roomId);
        vm.prank(alice);
        game.reveal(roomId, SECRET);

        uint256 pot = uint256(stake) * 2;
        uint256 expectedFee = (pot * FEE_BPS) / 10_000;
        uint256 accrued = game.accruedFees(address(cUsd));

        // Either full expected fee or zero (tie)
        assertTrue(accrued == expectedFee || accrued == 0);
    }
}
