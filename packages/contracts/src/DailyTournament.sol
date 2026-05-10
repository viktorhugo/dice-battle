// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DailyTournament
 * @author Cappy (Victor Hugo Mosquera Alvarado)
 * @notice Off-chain adjudicated daily leaderboard with on-chain prize distribution.
 *
 * Design (no cross-contract dependency):
 *   - DiceBattle is NOT modified. Win counts are read from the Envio indexer.
 *   - The owner (protocol cron at UTC midnight) calls setTopWinners with the
 *     top-3 addresses derived from indexer data.
 *   - Winners (or anyone on their behalf) call claim() any time after finalization.
 *   - The pool is funded by the owner from protocol-accrued fees via fundDay().
 *
 * Prize split: 50 % / 30 % / 20 %  (SHARES sums to 10 000 BPS)
 *
 * Trust model:
 *   The owner is trusted to supply accurate winner data from the indexer.
 *   This is an acceptable trade-off: DiceBattle stays immutable and the contract
 *   surface is minimal. A trustless version would require an oracle or ZK proof.
 *
 * Safety valves:
 *   - sweepUnclaimed() lets the owner recover funds 30 days after finalization
 *     in case a winner never calls claim() or had address(0) at their rank.
 */
contract DailyTournament is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =============================================================
    //                          CONSTANTS
    // =============================================================

    uint256 public constant DAY_SECONDS = 86_400;

    /// @notice Delay after finalization before unclaimed funds can be swept.
    uint256 public constant SWEEP_DELAY = 30 days;

    /// @notice Prize shares in BPS (must sum to 10 000).
    uint16 public constant SHARE_FIRST  = 5_000; // 50%
    uint16 public constant SHARE_SECOND = 3_000; // 30%
    uint16 public constant SHARE_THIRD  = 2_000; // 20%

    // =============================================================
    //                          STORAGE
    // =============================================================

    /// @notice The single stablecoin used for this tournament (e.g. USDT).
    IERC20 public immutable token;

    struct Day {
        uint128 pool;          // total prize pool funded for this day
        uint64  finalizedAt;   // timestamp of setTopWinners; 0 = not yet finalized
        uint8   claimed;       // bitmask: bit i set = rank i already claimed
        address[3] top;        // top-3 winner addresses (address(0) = no winner at rank)
        uint32[3]  winCounts;  // win counts for each address, descending
    }

    /// @notice State for each day. dayId = block.timestamp / DAY_SECONDS.
    mapping(uint256 => Day) public tournamentDays;

    // =============================================================
    //                          EVENTS
    // =============================================================

    event DayFunded(uint256 indexed dayId, uint256 amount, uint128 totalPool);
    event WinnersSet(uint256 indexed dayId, address[3] top, uint32[3] wins, uint128 pool);
    event Claimed(uint256 indexed dayId, uint8 indexed rank, address indexed winner, uint256 amount);
    event UnclaimedSwept(uint256 indexed dayId, uint256 amount);

    // =============================================================
    //                          ERRORS
    // =============================================================

    error DayNotOver();
    error AlreadyFinalized();
    error NotFinalized();
    error AlreadyClaimed();
    error NoWinnerAtRank();
    error ZeroAmount();
    error SweepTooEarly();
    error NothingToSweep();
    error InvalidWinners();
    error InvalidRank();

    // =============================================================
    //                       CONSTRUCTOR
    // =============================================================

    /// @param _token Stablecoin address used for prize distribution.
    /// @param _owner Protocol multisig / deployer address.
    constructor(IERC20 _token, address _owner) Ownable(_owner) {
        token = _token;
    }

    // =============================================================
    //                       CORE FUNCTIONS
    // =============================================================

    /**
     * @notice Add funds to the prize pool for a future or current day.
     * @dev Can be called multiple times before finalization. Tokens are pulled
     *      from the caller (owner) via safeTransferFrom.
     * @param dayId  Day identifier (block.timestamp / DAY_SECONDS).
     * @param amount Amount of `token` to add to the pool.
     */
    function fundDay(uint256 dayId, uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (tournamentDays[dayId].finalizedAt != 0) revert AlreadyFinalized();

        // uint128 cast is safe: reverts on overflow in 0.8.x
        tournamentDays[dayId].pool += uint128(amount);
        token.safeTransferFrom(msg.sender, address(this), amount);

        emit DayFunded(dayId, amount, tournamentDays[dayId].pool);
    }

    /**
     * @notice Record the top-3 winners for a completed day. Callable once per day.
     * @dev Called by the protocol cron at UTC midnight with data from the Envio indexer.
     *      - top[0] must be a non-zero address (at least one winner required).
     *      - top[1] and top[2] may be address(0) if fewer than 3 players competed.
     *      - winCounts must be non-increasing for non-zero addresses.
     *      - Duplicate addresses are rejected.
     * @param dayId    The completed day's identifier.
     * @param top      Top-3 addresses in descending win order.
     * @param winCounts Win counts corresponding to each address.
     */
    function setTopWinners(
        uint256 dayId,
        address[3] calldata top,
        uint32[3]  calldata winCounts
    ) external onlyOwner {
        if (block.timestamp < (dayId + 1) * DAY_SECONDS) revert DayNotOver();
        if (tournamentDays[dayId].finalizedAt != 0) revert AlreadyFinalized();
        if (top[0] == address(0)) revert InvalidWinners();

        // Validate descending win counts and no duplicates for populated ranks
        if (top[1] != address(0)) {
            if (winCounts[1] > winCounts[0]) revert InvalidWinners();
            if (top[1] == top[0]) revert InvalidWinners();
        }
        if (top[2] != address(0)) {
            if (top[1] == address(0)) revert InvalidWinners(); // can't skip rank 1
            if (winCounts[2] > winCounts[1]) revert InvalidWinners();
            if (top[2] == top[0] || top[2] == top[1]) revert InvalidWinners();
        }

        tournamentDays[dayId].finalizedAt = uint64(block.timestamp);
        tournamentDays[dayId].top         = top;
        tournamentDays[dayId].winCounts   = winCounts;

        emit WinnersSet(dayId, top, winCounts, tournamentDays[dayId].pool);
    }

    /**
     * @notice Claim prize for a given rank in a finalized day.
     * @dev Anyone can call on behalf of a winner; tokens always go to the
     *      winner's address, never to the caller.
     * @param dayId The finalized day.
     * @param rank  0 = 1st place, 1 = 2nd place, 2 = 3rd place.
     */
    function claim(uint256 dayId, uint8 rank) external nonReentrant {
        if (rank > 2) revert InvalidRank();

        Day storage d = tournamentDays[dayId];
        if (d.finalizedAt == 0) revert NotFinalized();

        address winner = d.top[rank];
        if (winner == address(0)) revert NoWinnerAtRank();

        uint8 mask = uint8(1 << rank);
        if (d.claimed & mask != 0) revert AlreadyClaimed();

        // Check-Effects-Interactions: mark claimed before transfer
        d.claimed |= mask;

        uint256 amount = (uint256(d.pool) * _share(rank)) / 10_000;
        if (amount > 0) {
            token.safeTransfer(winner, amount);
        }

        emit Claimed(dayId, rank, winner, amount);
    }

    /**
     * @notice Sweep unclaimed prize shares back to the owner after the grace period.
     * @dev Safety valve for zero-address slots or winners who never claim.
     *      Can only be called 30 days after finalization.
     * @param dayId The finalized day to sweep.
     */
    function sweepUnclaimed(uint256 dayId) external onlyOwner nonReentrant {
        Day storage d = tournamentDays[dayId];
        if (d.finalizedAt == 0) revert NotFinalized();
        if (block.timestamp < uint256(d.finalizedAt) + SWEEP_DELAY) revert SweepTooEarly();

        uint256 remaining = 0;
        for (uint8 rank = 0; rank < 3; rank++) {
            uint8 mask = uint8(1 << rank);
            if (d.claimed & mask == 0) {
                d.claimed |= mask; // mark to prevent re-entry via a second sweep
                remaining += (uint256(d.pool) * _share(rank)) / 10_000;
            }
        }

        if (remaining == 0) revert NothingToSweep();
        token.safeTransfer(owner(), remaining);

        emit UnclaimedSwept(dayId, remaining);
    }

    // =============================================================
    //                          INTERNAL
    // =============================================================

    /// @dev Returns the BPS share for a given rank (0, 1, or 2).
    function _share(uint8 rank) internal pure returns (uint16) {
        if (rank == 0) return SHARE_FIRST;
        if (rank == 1) return SHARE_SECOND;
        return SHARE_THIRD;
    }

    // =============================================================
    //                          VIEWS
    // =============================================================

    /// @notice Returns the current UTC day ID.
    function currentDayId() external view returns (uint256) {
        return block.timestamp / DAY_SECONDS;
    }

    /**
     * @notice Returns full state for a day in a single call (frontend-friendly).
     * @return pool      Total prize pool.
     * @return finalized Whether setTopWinners has been called.
     * @return top       Top-3 winner addresses.
     * @return wins      Win counts.
     * @return prizes    Claimable amounts per rank (0 if already claimed).
     * @return claimed   Whether each rank has been claimed.
     */
    function dayInfo(uint256 dayId)
        external
        view
        returns (
            uint128          pool,
            bool             finalized,
            address[3] memory top,
            uint32[3]  memory wins,
            uint256[3] memory prizes,
            bool[3]    memory claimed
        )
    {
        Day storage d = tournamentDays[dayId];
        pool      = d.pool;
        finalized = d.finalizedAt != 0;
        top       = d.top;
        wins      = d.winCounts;
        for (uint8 i = 0; i < 3; i++) {
            prizes[i]  = (uint256(d.pool) * _share(i)) / 10_000;
            claimed[i] = (d.claimed & uint8(1 << i)) != 0;
        }
    }
}
