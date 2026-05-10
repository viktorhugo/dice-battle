// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {DailyTournament} from "../src/DailyTournament.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * Deploy script for DailyTournament.
 *
 * Usage:
 *   forge script script/DeployTournament.s.sol:DeployTournament \
 *     --rpc-url celo_sepolia \
 *     --account celo-sepolia \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 *
 *   forge script script/DeployTournament.s.sol:DeployTournament \
 *     --rpc-url celo \
 *     --account celo-mainnet \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 *
 * Requires env vars:
 *   CELOSCAN_API_KEY   for --verify
 *
 * After deploy:
 *   1. Owner must approve DailyTournament to spend the prize token.
 *   2. Set up cron at UTC midnight to call setTopWinners() with indexer data.
 *   3. Update frontend env with NEXT_PUBLIC_TOURNAMENT_ADDRESS.
 */
contract DeployTournament is Script {
    // Celo mainnet stablecoins
    address internal constant USDT_MAINNET = 0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e;

    // Celo Sepolia testnet stablecoins
    address internal constant USDT_SEPOLIA = 0xd077A400968890Eacc75cdc901F0356c943e4fDb;

    function run() external {
        uint256 chainId = block.chainid;
        address prizeToken;

        if (chainId == 42_220) {
            prizeToken = USDT_MAINNET;
        } else if (chainId == 11_142_220) {
            prizeToken = USDT_SEPOLIA;
        } else {
            revert("Unsupported chain: add token address first");
        }

        vm.startBroadcast();

        address deployer = msg.sender;
        DailyTournament tournament = new DailyTournament(IERC20(prizeToken), deployer);

        console2.log("Chain ID:             ", chainId);
        console2.log("Deployer (owner):     ", deployer);
        console2.log("Prize token:          ", prizeToken);
        console2.log("DailyTournament at:   ", address(tournament));
        console2.log("DAY_SECONDS:          ", tournament.DAY_SECONDS());
        console2.log("SWEEP_DELAY:          ", tournament.SWEEP_DELAY());

        vm.stopBroadcast();

        console2.log("\nNext steps:");
        console2.log("  1. Approve DailyTournament to spend prize token from owner wallet");
        console2.log("  2. Call fundDay(currentDayId, amount) to seed the first day");
        console2.log("  3. Set up a UTC-midnight cron to call setTopWinners()");
        console2.log("  4. Update NEXT_PUBLIC_TOURNAMENT_ADDRESS in apps/web/.env.local");
    }
}
