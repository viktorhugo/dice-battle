// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DailyTournament} from "../src/DailyTournament.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DailyTournamentTest is Test {
    DailyTournament internal tournament;
    MockERC20       internal usdt;

    address internal owner  = makeAddr("owner");
    address internal alice  = makeAddr("alice");
    address internal bob    = makeAddr("bob");
    address internal carol  = makeAddr("carol");

    uint256 internal constant POOL    = 10 ether; // 10 USDT (18-dec mock)
    uint256 internal constant DAY_0   = 0;        // unix epoch day 0

    // --- Helpers ---

    function _defaultTop()    internal view returns (address[3] memory) { return [alice, bob, carol]; }
    function _defaultWins()   internal pure returns (uint32[3] memory)  { return [uint32(10), 5, 2]; }

    /// Warp to a point where dayId is "over" (can call setTopWinners)
    function _endDay(uint256 dayId) internal {
        vm.warp((dayId + 1) * tournament.DAY_SECONDS());
    }

    /// Fund + finalize a day with alice/bob/carol as top-3
    function _setupFinalized(uint256 dayId) internal returns (DailyTournament.Day memory) {
        // Fund
        vm.startPrank(owner);
        usdt.mint(owner, POOL);
        usdt.approve(address(tournament), POOL);
        tournament.fundDay(dayId, POOL);

        // Finalize
        _endDay(dayId);
        tournament.setTopWinners(dayId, _defaultTop(), _defaultWins());
        vm.stopPrank();

        (
            uint128 pool,,,,,
        ) = _info(dayId);
        DailyTournament.Day memory d;
        d.pool = pool;
        return d;
    }

    function _info(uint256 dayId)
        internal
        view
        returns (
            uint128, bool, address[3] memory, uint32[3] memory,
            uint256[3] memory, bool[3] memory
        )
    {
        return tournament.dayInfo(dayId);
    }

    // --- Setup ---

    function setUp() public {
        usdt = new MockERC20("Tether", "USDT", 18);

        vm.prank(owner);
        tournament = new DailyTournament(IERC20(address(usdt)), owner);
    }

    // ============================================================
    //                        fundDay
    // ============================================================

    function test_fundDay_addsToPool() public {
        vm.startPrank(owner);
        usdt.mint(owner, POOL);
        usdt.approve(address(tournament), POOL);

        tournament.fundDay(DAY_0, POOL);
        vm.stopPrank();

        (uint128 pool,,,,,) = _info(DAY_0);
        assertEq(pool, POOL);
        assertEq(usdt.balanceOf(address(tournament)), POOL);
    }

    function test_fundDay_canAddMultipleTimes() public {
        vm.startPrank(owner);
        usdt.mint(owner, POOL * 2);
        usdt.approve(address(tournament), POOL * 2);

        tournament.fundDay(DAY_0, POOL);
        tournament.fundDay(DAY_0, POOL);
        vm.stopPrank();

        (uint128 pool,,,,,) = _info(DAY_0);
        assertEq(pool, POOL * 2);
    }

    function test_fundDay_revertsOnZeroAmount() public {
        vm.prank(owner);
        vm.expectRevert(DailyTournament.ZeroAmount.selector);
        tournament.fundDay(DAY_0, 0);
    }

    function test_fundDay_revertsOnNonOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        tournament.fundDay(DAY_0, POOL);
    }

    function test_fundDay_revertsAfterFinalized() public {
        _setupFinalized(DAY_0);

        vm.startPrank(owner);
        usdt.mint(owner, POOL);
        usdt.approve(address(tournament), POOL);
        vm.expectRevert(DailyTournament.AlreadyFinalized.selector);
        tournament.fundDay(DAY_0, POOL);
        vm.stopPrank();
    }

    // ============================================================
    //                      setTopWinners
    // ============================================================

    function test_setTopWinners_storesWinnersCorrectly() public {
        _endDay(DAY_0);

        vm.prank(owner);
        tournament.setTopWinners(DAY_0, _defaultTop(), _defaultWins());

        (, bool finalized, address[3] memory top, uint32[3] memory wins,,) = _info(DAY_0);
        assertTrue(finalized);
        assertEq(top[0], alice);
        assertEq(top[1], bob);
        assertEq(top[2], carol);
        assertEq(wins[0], 10);
        assertEq(wins[1], 5);
        assertEq(wins[2], 2);
    }

    function test_setTopWinners_allowsOneWinner() public {
        _endDay(DAY_0);
        address[3] memory top   = [alice, address(0), address(0)];
        uint32[3]  memory wins  = [uint32(7), 0, 0];

        vm.prank(owner);
        tournament.setTopWinners(DAY_0, top, wins);

        (, bool finalized, address[3] memory storedTop,,,) = _info(DAY_0);
        assertTrue(finalized);
        assertEq(storedTop[0], alice);
        assertEq(storedTop[1], address(0));
    }

    function test_setTopWinners_revertsBeforeDayOver() public {
        // Still within day 0 (timestamp < DAY_SECONDS)
        vm.prank(owner);
        vm.expectRevert(DailyTournament.DayNotOver.selector);
        tournament.setTopWinners(DAY_0, _defaultTop(), _defaultWins());
    }

    function test_setTopWinners_revertsIfAlreadyFinalized() public {
        _endDay(DAY_0);
        vm.startPrank(owner);
        tournament.setTopWinners(DAY_0, _defaultTop(), _defaultWins());

        vm.expectRevert(DailyTournament.AlreadyFinalized.selector);
        tournament.setTopWinners(DAY_0, _defaultTop(), _defaultWins());
        vm.stopPrank();
    }

    function test_setTopWinners_revertsIfFirstAddressIsZero() public {
        _endDay(DAY_0);
        address[3] memory top = [address(0), alice, bob];
        uint32[3]  memory wins = [uint32(5), 3, 1];

        vm.prank(owner);
        vm.expectRevert(DailyTournament.InvalidWinners.selector);
        tournament.setTopWinners(DAY_0, top, wins);
    }

    function test_setTopWinners_revertsOnDuplicateAddresses() public {
        _endDay(DAY_0);
        address[3] memory top  = [alice, alice, bob]; // duplicate
        uint32[3]  memory wins = [uint32(10), 5, 2];

        vm.prank(owner);
        vm.expectRevert(DailyTournament.InvalidWinners.selector);
        tournament.setTopWinners(DAY_0, top, wins);
    }

    function test_setTopWinners_revertsOnNonDescendingWins() public {
        _endDay(DAY_0);
        address[3] memory top  = _defaultTop();
        uint32[3]  memory wins = [uint32(3), 10, 1]; // rank 1 > rank 0

        vm.prank(owner);
        vm.expectRevert(DailyTournament.InvalidWinners.selector);
        tournament.setTopWinners(DAY_0, top, wins);
    }

    function test_setTopWinners_revertsOnSkippedRank() public {
        // top[1] = address(0) but top[2] is set; skipping rank 1
        _endDay(DAY_0);
        address[3] memory top  = [alice, address(0), carol];
        uint32[3]  memory wins = [uint32(10), 0, 2];

        vm.prank(owner);
        vm.expectRevert(DailyTournament.InvalidWinners.selector);
        tournament.setTopWinners(DAY_0, top, wins);
    }

    function test_setTopWinners_revertsOnNonOwner() public {
        _endDay(DAY_0);
        vm.prank(alice);
        vm.expectRevert();
        tournament.setTopWinners(DAY_0, _defaultTop(), _defaultWins());
    }

    // ============================================================
    //                          claim
    // ============================================================

    function test_claim_rank0_receives50Pct() public {
        _setupFinalized(DAY_0);

        uint256 expected = (POOL * 5_000) / 10_000; // 50%
        uint256 before   = usdt.balanceOf(alice);

        tournament.claim(DAY_0, 0);

        assertEq(usdt.balanceOf(alice) - before, expected);
    }

    function test_claim_rank1_receives30Pct() public {
        _setupFinalized(DAY_0);

        uint256 expected = (POOL * 3_000) / 10_000; // 30%
        uint256 before   = usdt.balanceOf(bob);

        tournament.claim(DAY_0, 1);

        assertEq(usdt.balanceOf(bob) - before, expected);
    }

    function test_claim_rank2_receives20Pct() public {
        _setupFinalized(DAY_0);

        uint256 expected = (POOL * 2_000) / 10_000; // 20%
        uint256 before   = usdt.balanceOf(carol);

        tournament.claim(DAY_0, 2);

        assertEq(usdt.balanceOf(carol) - before, expected);
    }

    function test_claim_anyoneCanTriggerOnBehalfOfWinner() public {
        _setupFinalized(DAY_0);

        uint256 before = usdt.balanceOf(alice);

        // Carol (not alice) triggers alice's claim
        vm.prank(carol);
        tournament.claim(DAY_0, 0);

        // Tokens go to alice, not carol
        assertGt(usdt.balanceOf(alice), before);
    }

    function test_claim_allThreeRanks_contractEmptied() public {
        _setupFinalized(DAY_0);

        tournament.claim(DAY_0, 0);
        tournament.claim(DAY_0, 1);
        tournament.claim(DAY_0, 2);

        // Rounding dust may remain (<= 1 wei per rank), so allow tiny remainder
        assertLe(usdt.balanceOf(address(tournament)), 3);
    }

    function test_claim_revertsBeforeFinalized() public {
        vm.expectRevert(DailyTournament.NotFinalized.selector);
        tournament.claim(DAY_0, 0);
    }

    function test_claim_revertsAlreadyClaimed() public {
        _setupFinalized(DAY_0);

        tournament.claim(DAY_0, 0);

        vm.expectRevert(DailyTournament.AlreadyClaimed.selector);
        tournament.claim(DAY_0, 0);
    }

    function test_claim_revertsForZeroAddressWinner() public {
        _endDay(DAY_0);
        // Only 1 winner
        address[3] memory top  = [alice, address(0), address(0)];
        uint32[3]  memory wins = [uint32(5), 0, 0];
        vm.prank(owner);
        tournament.setTopWinners(DAY_0, top, wins);

        vm.expectRevert(DailyTournament.NoWinnerAtRank.selector);
        tournament.claim(DAY_0, 1); // rank 1 has no winner
    }

    function test_claim_revertsOnInvalidRank() public {
        _setupFinalized(DAY_0);

        vm.expectRevert(DailyTournament.InvalidRank.selector);
        tournament.claim(DAY_0, 3);
    }

    // ============================================================
    //                      sweepUnclaimed
    // ============================================================

    function test_sweepUnclaimed_sweepsAfterGracePeriod() public {
        _setupFinalized(DAY_0);
        // alice claims rank 0; bob and carol do not
        tournament.claim(DAY_0, 0);

        // Fast-forward past sweep delay
        (, bool fin,,,, ) = _info(DAY_0);
        assertTrue(fin);
        vm.warp(block.timestamp + tournament.SWEEP_DELAY() + 1);

        uint256 before = usdt.balanceOf(owner);
        vm.prank(owner);
        tournament.sweepUnclaimed(DAY_0);

        // Owner should receive bob's 30% + carol's 20% = 50%
        uint256 expected = (POOL * 3_000) / 10_000 + (POOL * 2_000) / 10_000;
        assertApproxEqAbs(usdt.balanceOf(owner) - before, expected, 2);
    }

    function test_sweepUnclaimed_revertsBeforeGracePeriod() public {
        _setupFinalized(DAY_0);
        // Advance only 1 day (not enough)
        vm.warp(block.timestamp + 1 days);

        vm.prank(owner);
        vm.expectRevert(DailyTournament.SweepTooEarly.selector);
        tournament.sweepUnclaimed(DAY_0);
    }

    function test_sweepUnclaimed_revertsIfNothingLeft() public {
        _setupFinalized(DAY_0);

        tournament.claim(DAY_0, 0);
        tournament.claim(DAY_0, 1);
        tournament.claim(DAY_0, 2);

        vm.warp(block.timestamp + tournament.SWEEP_DELAY() + 1);
        vm.prank(owner);
        vm.expectRevert(DailyTournament.NothingToSweep.selector);
        tournament.sweepUnclaimed(DAY_0);
    }

    function test_sweepUnclaimed_revertsBeforeFinalized() public {
        vm.warp(block.timestamp + tournament.SWEEP_DELAY() + 1);
        vm.prank(owner);
        vm.expectRevert(DailyTournament.NotFinalized.selector);
        tournament.sweepUnclaimed(DAY_0);
    }

    // ============================================================
    //                        currentDayId
    // ============================================================

    function test_currentDayId_matchesExpected() public {
        vm.warp(2 * tournament.DAY_SECONDS() + 3600);
        assertEq(tournament.currentDayId(), 2);
    }

    // ============================================================
    //                        FUZZ TESTS
    // ============================================================

    /// @dev Fuzz: 50%+30%+20% of any pool never exceeds the pool itself (no over-distribution).
    function testFuzz_prizeShares_doNotExceedPool(uint128 pool) public pure {
        vm.assume(pool > 0 && pool <= type(uint128).max / 10_000);
        uint256 total = (uint256(pool) * 5_000 + uint256(pool) * 3_000 + uint256(pool) * 2_000) / 10_000;
        assertLe(total, pool);
    }

    /// @dev Fuzz: claimed bitmask prevents any rank from being claimed twice.
    function testFuzz_claimedBitmask_preventsDoubleClaim(uint8 rank) public {
        rank = uint8(bound(rank, 0, 2));
        _setupFinalized(DAY_0);

        tournament.claim(DAY_0, rank);

        vm.expectRevert(DailyTournament.AlreadyClaimed.selector);
        tournament.claim(DAY_0, rank);
    }

    /// @dev Fuzz: setTopWinners on any future dayId works correctly.
    function testFuzz_setTopWinners_anyFutureDay(uint16 futureDayOffset) public {
        vm.assume(futureDayOffset > 0 && futureDayOffset < 3_650);
        uint256 dayId = block.timestamp / tournament.DAY_SECONDS() + futureDayOffset;

        _endDay(dayId);
        vm.prank(owner);
        tournament.setTopWinners(dayId, _defaultTop(), _defaultWins());

        (, bool finalized,,,, ) = _info(dayId);
        assertTrue(finalized);
    }

    /// @dev Fuzz: claiming rank 0 always gives exactly 50% of the pool.
    function testFuzz_claim_rank0_alwaysHalf(uint128 pool) public {
        pool = uint128(bound(pool, 2, type(uint128).max / 10_000));

        vm.startPrank(owner);
        usdt.mint(owner, pool);
        usdt.approve(address(tournament), pool);
        tournament.fundDay(DAY_0, pool);
        _endDay(DAY_0);
        tournament.setTopWinners(DAY_0, _defaultTop(), _defaultWins());
        vm.stopPrank();

        uint256 before   = usdt.balanceOf(alice);
        tournament.claim(DAY_0, 0);

        uint256 expected = (uint256(pool) * 5_000) / 10_000;
        assertEq(usdt.balanceOf(alice) - before, expected);
    }
}
