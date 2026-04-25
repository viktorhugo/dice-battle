// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {DiceBattle} from "../src/DiceBattle.sol";

/**
 * Deploy script for DiceBattle.
 *
 * Usage:
 *   forge script script/Deploy.s.sol:Deploy \
 *     --rpc-url celo_sepolia \
 *     --account celo-sepolia \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 *
 *   forge script script/Deploy.s.sol:Deploy \
 *     --rpc-url celo \
 *     --account celo-mainnet \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 *
 * Requires env vars:
 *   CELOSCAN_API_KEY   — for --verify
 */
contract Deploy is Script {
    uint256 internal constant FEE_BPS = 200; // 2%

    // Celo mainnet stablecoins
    address internal constant CUSD_MAINNET = 0x765DE816845861e75A25fCA122bb6898B8B1282a;
    address internal constant USDT_MAINNET = 0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e;
    address internal constant USDC_MAINNET = 0xcebA9300f2b948710d2653dD7B07f33A8B32118C;

    // Celo Sepolia testnet stablecoin
    address internal constant CUSD_SEPOLIA = 0x01C5C0122039549AD1493B8220cABEdD739BC44E;
    address internal constant CELO_SEPOLIA = 0x4200000000000000000000000000000000000011;

    function run() external {
        uint256 chainId = block.chainid;

        vm.startBroadcast();

        DiceBattle game = new DiceBattle(FEE_BPS);
        console2.log("Deployer:", game.owner());
        console2.log("Chain ID:", chainId);
        console2.log("DiceBattle deployed at:", address(game));

        if (chainId == 42_220) {
            // Celo mainnet
            game.setTokenAllowed(CUSD_MAINNET, true);
            game.setTokenAllowed(USDT_MAINNET, true);
            game.setTokenAllowed(USDC_MAINNET, true);
            console2.log("Whitelisted cUSD, USDT and USDC on mainnet");
        } else if (chainId == 11_142_220) {
            // Celo Sepolia
            game.setTokenAllowed(CUSD_SEPOLIA, true);
            game.setTokenAllowed(CELO_SEPOLIA, true);
            console2.log("Whitelisted cUSD and CELO on Celo Sepolia");
        } else {
            console2.log("Unknown chain, skipping token whitelist");
        }

        vm.stopBroadcast();

        console2.log("\nNext steps:");
        console2.log("  1. Update frontend/.env.local with NEXT_PUBLIC_GAME_ADDRESS");
        console2.log("  2. Commit the deployment to your repo");
    }
}
