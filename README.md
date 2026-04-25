# Dice Battle 🎲

> PvP dice-rolling betting game built as a MiniApp for MiniPay, running on Celo mainnet.

[![CI](https://github.com/<your-user>/dice-battle/actions/workflows/ci.yml/badge.svg)](https://github.com/<your-user>/dice-battle/actions/workflows/ci.yml)
[![Celo](https://img.shields.io/badge/Celo-mainnet-FCFF52?style=flat)](https://celo.org)
[![MiniPay](https://img.shields.io/badge/MiniPay-compatible-%2300C4B3)](https://minipay.to)
[![Foundry](https://img.shields.io/badge/Built%20with-Foundry-black)](https://getfoundry.sh)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

## The problem

Casual peer-to-peer betting in Latin America happens constantly — pick a number, roll a dice, whoever's closest wins the coffee. But doing it with real stakes among friends requires someone to trust, someone to hold the pot, and someone to pay out. Every informal "apuesta" eventually hits the same wall: who is the bookkeeper?

## The solution

Dice Battle is a two-player dice battle where the escrow, the randomness, and the payout all live onchain. Stake 1 cUSD or USDT, invite a friend, the contract rolls two dice using verifiable onchain entropy, and the winner receives the pot minus a 2% protocol fee — all inside MiniPay, paid in stablecoins, with sub-cent gas.

- **No bookie.** The smart contract is the escrow.
- **Provably fair.** Uses `block.prevrandao` combined with a commit-reveal scheme so neither player can cheat.
- **Stablecoin native.** cUSD, USDT and USDC supported on day one.
- **MiniPay-first.** Detects the MiniPay environment and hides all wallet UX.
- **Gas in stablecoins.** Users pay fees in cUSD via CIP-64 fee abstraction.

## Monorepo layout

```
dice-battle/
├── apps/
│   └── web/              # Next.js 16 frontend with wagmi + viem
│       ├── app/          # App Router pages
│       ├── components/   # UI components
│       ├── hooks/        # Custom hooks (useMiniPay)
│       └── lib/          # wagmi config, constants, ABI, commitment utils
├── packages/
│   └── contracts/        # Foundry project
│       ├── src/          # DiceBattle.sol, MockERC20.sol
│       ├── test/         # Full test suite with fuzzing
│       └── script/       # Deploy.s.sol
├── scripts/
│   └── sync-abi.mjs      # Copies ABI from Foundry build → frontend
├── .github/workflows/    # CI (contracts + web in parallel)
├── package.json          # Root with pnpm workspaces
└── pnpm-workspace.yaml
```

The monorepo is managed with **pnpm workspaces**. The contract ABI is automatically synced from the Foundry build output to the frontend via `pnpm sync-abi` — no manual copy-paste ever.

## Randomness model

The game uses a **commit-reveal + prevrandao** pattern:

1. Player A commits `keccak256(abi.encode(secret, playerA))` when creating the room. The secret is generated in the browser and stored in localStorage — it never hits the blockchain until reveal.
2. Player B joins without knowing the secret.
3. Player A reveals the secret. The contract derives two dice rolls from `keccak256(secret, prevrandao, playerB, roomId)`.

This gives us:
- **Player A cannot predict the outcome** (prevrandao was not known when A committed).
- **Player B cannot influence the outcome** (A's commitment was locked before B joined).
- **The block proposer has at most 1 bit of influence** — acceptable for micro-stakes (max 5 USDT). For high-stakes games, a VRF oracle would be needed.

**Grief protection:** if Player A stalls on reveal, Player B can claim the full pot after a 200-block window via `claimExpired`.

## Tech stack

- **Smart contracts:** Solidity 0.8.24, OpenZeppelin 5.0, Foundry, viaIR
- **Testing:** Foundry (unit + fuzz + invariants) — 10 000 fuzz runs in CI
- **Randomness:** `block.prevrandao` + commit-reveal binding
- **Frontend:** Next.js 16 App Router, React 19, TypeScript strict
- **Onchain lib:** viem + wagmi (NOT ethers.js — incompatible with MiniPay)
- **Styling:** Tailwind CSS
- **Deployment:** Vercel (frontend), Celo mainnet (contract)
- **CI/CD:** GitHub Actions with parallel jobs for contracts and web

## Quick start

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- Node.js 22+
- pnpm 9+ (`npm i -g pnpm`)

### Setup

```bash
# Clone
git clone https://github.com/<your-user>/dice-battle
cd dice-battle

# Install all JS deps across the workspace
pnpm install

# Install Foundry deps (forge-std + OpenZeppelin as git submodules)
cd packages/contracts
make install
cd ../..

# Copy env files
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
```

### Daily dev loop

```bash
# Run contract tests
pnpm test:contracts

# Run frontend dev server
pnpm dev

# Lint and format everything
pnpm lint
pnpm fmt

# Run everything in CI mode (higher fuzz runs, type checks, build)
pnpm test
pnpm build
```

### Deploying

The deploy scripts use Foundry's encrypted keystore — no private key in environment variables.

```bash
# 1. Import your deployer wallet once (you'll be prompted for a password)
cast wallet import celo-sepolia --private-key <YOUR_PRIVATE_KEY>   # testnet
cast wallet import celo-mainnet --private-key <YOUR_PRIVATE_KEY>  # mainnet

# 2. Deploy (password prompt at runtime)
pnpm deploy:sepolia   # Celo Sepolia
pnpm deploy:mainnet   # Celo mainnet
```

After each deploy, update `apps/web/.env.local` with the new `NEXT_PUBLIC_GAME_ADDRESS`.

### Running in MiniPay

To test inside the MiniPay wallet on your phone:

1. `pnpm dev` — starts Next.js on `localhost:3000`
2. Tunnel with ngrok: `ngrok http 3000 --domain=your-static-domain.ngrok-free.app`
3. Open MiniPay → compass icon → "Test Page"
4. Paste the ngrok URL and tap "Go"
5. The app auto-connects — no "Connect Wallet" button needed

## Testing philosophy

The contract test suite includes:

- **Unit tests** for every happy path and revert case
- **Fuzz tests** (1 000 runs locally, 10 000 in CI) for:
  - Token leak invariant (contract holds exactly accrued fees, always)
  - Dice roll range (always 1-6 for any secret)
  - Fee math correctness across any stake from 1 wei to 1M tokens
- **Cheatcodes** like `vm.prevrandao` to exercise randomness paths deterministically

Run with:
```bash
pnpm --filter contracts test:fuzz
```

## Deployed contracts

| Network      | Address                       | Verification                                        |
| ------------ | ----------------------------- | --------------------------------------------------- |
| Celo mainnet | _to be filled after deploy_                        | [Celoscan](https://celoscan.io)                     |
| Celo Sepolia | `0x290FA37C3a08291A97E6B995BBC27a3a1A385e9C` | [Celoscan Sepolia](https://celo-sepolia.blockscout.com) |

## Why this belongs on MiniPay

MiniPay's user base transacts in stablecoins every day — 87% of peer-to-peer transactions are under $5. Dice Battle is built for exactly that pattern: fast, low-stakes, social transactions with a fun wrapper. A dice battle between friends is a 3-transaction flow that takes ~30 seconds. That's onchain activity MiniPay users actually want.

## Author

**Víctor Hugo Mosquera Alvarado (Cappy)**
Senior Full-Stack Web & Web3 Developer — Bogotá, Colombia

## License

MIT — see [LICENSE](./LICENSE).

## Acknowledgements

Built during [Proof of Ship](https://talent.app/~/earn/celo-proof-of-ship) April 2026 edition. Thanks to the Celo DevRel team and the MiniPay team for the tooling and support.
