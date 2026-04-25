// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DiceBattle
 * @author Cappy (Victor Hugo Mosquera Alvarado)
 * @notice PvP dice-rolling game with stablecoin bets for MiniPay users.
 *
 * Flow:
 *   1. Player A calls createRoom with a commitment hash and stakes tokens in escrow.
 *   2. Player B calls joinRoom, also staking the same amount.
 *   3. Player A calls reveal to expose their secret. The contract then uses
 *      keccak256(secret, prevrandao, playerB) to derive two dice rolls.
 *   4. The winner gets the pot minus the protocol fee; refunds on a tie.
 *
 * Randomness model:
 *   This game uses block.prevrandao combined with Player A's commitment for fairness.
 *   Player A cannot pre-compute the outcome (prevrandao is not known at create time).
 *   Player B cannot influence it (commitment was locked before B joined).
 *   The proposer (validator) has at most 1 bit of influence, acceptable for micro-stakes.
 *   For high-stakes games, a dedicated VRF would be required.
 */
contract DiceBattle is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    enum RoomState {
        None,
        Open,
        Matched,
        Resolved,
        Expired
    }

    struct Room {
        address playerA;
        address playerB;
        IERC20 token;
        uint128 stake;
        uint64 matchedAtBlock;
        bytes32 commitment; // keccak256(abi.encode(secret, playerA))
        RoomState state;
    }

    // =============================================================
    //                          STORAGE
    // =============================================================

    /// @notice Fee in basis points taken from the total pot (e.g. 200 = 2%).
    uint256 public feeBps;

    /// @notice Absolute ceiling on the fee to protect users from governance abuse.
    uint256 public constant MAX_FEE_BPS = 500; // 5%

    /// @notice Window in blocks Player A has to reveal before B can claim the pot.
    uint256 public constant REVEAL_WINDOW_BLOCKS = 200;

    /// @notice Whitelist of tokens accepted for bets.
    mapping(address => bool) public allowedTokens;

    /// @notice Rooms indexed by roomId.
    mapping(uint256 => Room) public rooms;

    /// @notice Autoincremented room counter.
    uint256 public nextRoomId;

    /// @notice Accumulated protocol fees per token, claimable by owner.
    mapping(address => uint256) public accruedFees;

    // =============================================================
    //                          EVENTS
    // =============================================================

    event RoomCreated(
        uint256 indexed roomId,
        address indexed playerA,
        address indexed token,
        uint256 stake,
        bytes32 commitment
    );
    event RoomJoined(uint256 indexed roomId, address indexed playerB, uint256 matchedAtBlock);
    event RoomResolved(
        uint256 indexed roomId,
        address indexed winner,
        uint8 rollA,
        uint8 rollB,
        uint256 payout,
        uint256 fee
    );
    event RoomTied(uint256 indexed roomId, uint8 rollA, uint8 rollB);
    event RoomExpiredClaim(uint256 indexed roomId, address indexed claimer);
    event RoomCancelled(uint256 indexed roomId);
    event TokenWhitelisted(address indexed token, bool allowed);
    event FeeUpdated(uint256 newBps);
    event FeesWithdrawn(address indexed token, uint256 amount);

    // =============================================================
    //                          ERRORS
    // =============================================================

    error TokenNotAllowed();
    error StakeTooLow();
    error RoomNotOpen();
    error RoomNotMatched();
    error NotPlayerA();
    error NotPlayerB();
    error SameAsPlayerA();
    error InvalidReveal();
    error RevealWindowActive();
    error FeeTooHigh();
    error ZeroAmount();

    // =============================================================
    //                       CONSTRUCTOR
    // =============================================================

    constructor(uint256 _feeBps) Ownable(msg.sender) {
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        feeBps = _feeBps;
    }

    // =============================================================
    //                       CORE GAME LOGIC
    // =============================================================

    /**
     * @notice Create a new room with a commitment and stake.
     * @dev The commitment MUST be keccak256(abi.encode(secret, msg.sender)).
     *      Binding to msg.sender prevents an attacker from reusing a stolen commitment.
     * @param token Address of the stablecoin (cUSD or USDT).
     * @param stake Amount to stake. Player B must match exactly this.
     * @param commitment Hash of the secret + playerA address.
     */
    function createRoom(
        IERC20 token,
        uint128 stake,
        bytes32 commitment
    ) external nonReentrant returns (uint256 roomId) {
        if (!allowedTokens[address(token)]) revert TokenNotAllowed();
        if (stake == 0) revert StakeTooLow();

        roomId = nextRoomId++;
        rooms[roomId] = Room({
            playerA: msg.sender,
            playerB: address(0),
            token: token,
            stake: stake,
            matchedAtBlock: 0,
            commitment: commitment,
            state: RoomState.Open
        });

        token.safeTransferFrom(msg.sender, address(this), stake);

        emit RoomCreated(roomId, msg.sender, address(token), stake, commitment);
    }

    /**
     * @notice Join an open room, matching the stake.
     */
    function joinRoom(uint256 roomId) external nonReentrant {
        Room storage room = rooms[roomId];
        if (room.state != RoomState.Open) revert RoomNotOpen();
        if (msg.sender == room.playerA) revert SameAsPlayerA();

        room.playerB = msg.sender;
        room.matchedAtBlock = uint64(block.number);
        room.state = RoomState.Matched;

        room.token.safeTransferFrom(msg.sender, address(this), room.stake);

        emit RoomJoined(roomId, msg.sender, block.number);
    }

    /**
     * @notice Player A reveals the secret and the contract resolves the game.
     * @param roomId Room to resolve.
     * @param secret Preimage of the commitment.
     */
    function reveal(uint256 roomId, bytes32 secret) external nonReentrant {
        Room storage room = rooms[roomId];
        if (room.state != RoomState.Matched) revert RoomNotMatched();
        if (msg.sender != room.playerA) revert NotPlayerA();
        if (keccak256(abi.encode(secret, msg.sender)) != room.commitment) revert InvalidReveal();

        // Derive two dice rolls from the secret, prevrandao, and Player B.
        // prevrandao provides entropy not known at create time, secret
        // prevents B from predicting, B address prevents A from pre-selecting
        // an advantageous seed (A does not know B at create time).
        uint256 seed = uint256(
            keccak256(
                abi.encode(
                    secret, block.prevrandao, room.playerB, roomId
                )
            )
        );

        uint8 rollA = uint8((seed & 0xFF) % 6) + 1;
        uint8 rollB = uint8(((seed >> 8) & 0xFF) % 6) + 1;

        _settle(roomId, room, rollA, rollB);
    }

    /**
     * @notice If Player A never reveals within the window, B can claim the pot.
     * @dev This is a grief-protection mechanism. A loses their stake if they
     *      try to stall after seeing an unfavorable pending prevrandao.
     */
    function claimExpired(uint256 roomId) external nonReentrant {
        Room storage room = rooms[roomId];
        if (room.state != RoomState.Matched) revert RoomNotMatched();
        if (msg.sender != room.playerB) revert NotPlayerB();
        if (block.number < room.matchedAtBlock + REVEAL_WINDOW_BLOCKS) {
            revert RevealWindowActive();
        }

        room.state = RoomState.Expired;
        uint256 pot = uint256(room.stake) * 2;
        uint256 fee = (pot * feeBps) / 10_000;
        uint256 payout = pot - fee;

        accruedFees[address(room.token)] += fee;
        room.token.safeTransfer(room.playerB, payout);

        emit RoomExpiredClaim(roomId, room.playerB);
    }

    /**
     * @notice Player A can cancel an unmatched room and recover their stake.
     */
    function cancelRoom(uint256 roomId) external nonReentrant {
        Room storage room = rooms[roomId];
        if (room.state != RoomState.Open) revert RoomNotOpen();
        if (msg.sender != room.playerA) revert NotPlayerA();

        room.state = RoomState.Resolved;
        room.token.safeTransfer(room.playerA, room.stake);

        emit RoomCancelled(roomId);
    }

    // =============================================================
    //                          INTERNAL
    // =============================================================

    function _settle(uint256 roomId, Room storage room, uint8 rollA, uint8 rollB) private {
        room.state = RoomState.Resolved;

        if (rollA == rollB) {
            // Tie: refund both players, no fee charged.
            room.token.safeTransfer(room.playerA, room.stake);
            room.token.safeTransfer(room.playerB, room.stake);
            emit RoomTied(roomId, rollA, rollB);
            return;
        }

        address winner = rollA > rollB ? room.playerA : room.playerB;
        uint256 pot = uint256(room.stake) * 2;
        uint256 fee = (pot * feeBps) / 10_000;
        uint256 payout = pot - fee;

        accruedFees[address(room.token)] += fee;
        room.token.safeTransfer(winner, payout);

        emit RoomResolved(roomId, winner, rollA, rollB, payout, fee);
    }

    // =============================================================
    //                       ADMIN FUNCTIONS
    // =============================================================

    function setTokenAllowed(address token, bool allowed) external onlyOwner {
        allowedTokens[token] = allowed;
        emit TokenWhitelisted(token, allowed);
    }

    function setFeeBps(uint256 newBps) external onlyOwner {
        if (newBps > MAX_FEE_BPS) revert FeeTooHigh();
        feeBps = newBps;
        emit FeeUpdated(newBps);
    }

    function withdrawFees(address token, address to) external onlyOwner {
        uint256 amount = accruedFees[token];
        if (amount == 0) revert ZeroAmount();
        accruedFees[token] = 0;
        IERC20(token).safeTransfer(to, amount);
        emit FeesWithdrawn(token, amount);
    }

    // =============================================================
    //                          HELPERS
    // =============================================================

    /**
     * @notice Helper for the frontend to build a commitment.
     * @dev Use this offchain with a random secret to avoid leaking it onchain.
     */
    function computeCommitment(bytes32 secret, address player) external pure returns (bytes32 result) {
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, secret)
            mstore(add(ptr, 0x20), player)
            result := keccak256(ptr, 0x40)
        }
    }
}
