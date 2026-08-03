# MiniPay Submission — Dice Battle

## App Info

| Field       | Value                                                                    |
|-------------|--------------------------------------------------------------------------|
| Name        | Dice Battle                                                              |
| URL         | https://dice-battle-web.vercel.app                                       |
| Category    | Games                                                                    |
| Publisher   | Víctor Hugo Mosquera Alvarado                                            |
| Support     | https://t.me/dicebattle_support                                          |
| Icon        | 512×512 PNG — dado dorado sobre fondo #0C0C0C                            |

---

## Smart Contracts (Celo Mainnet — Chain ID 42220)

| Contract         | Address                                      | Celoscan                                                                              |
|------------------|----------------------------------------------|---------------------------------------------------------------------------------------|
| DiceBattle       | `0x320Ee4e931B7182eD4BFC085aaa3060895B6A6B6` | https://celoscan.io/address/0x320Ee4e931B7182eD4BFC085aaa3060895B6A6B6               |
| DailyTournament  | `0x9F74B63a23CCdc314840f5aA0Bd8c8Ac9Dd78257` | https://celoscan.io/address/0x9F74B63a23CCdc314840f5aA0Bd8c8Ac9Dd78257               |

### Sample Transactions per Method

| Method            | Celoscan TX |
|-------------------|-------------|
| `createRoom`      | _(add link after first mainnet game)_ |
| `joinRoom`        | _(add link after first mainnet game)_ |
| `revealAndSettle` | _(add link after first mainnet game)_ |
| `claimExpired`    | _(add link after first mainnet game)_ |
| `cancelRoom`      | _(add link after first mainnet game)_ |

---

## External APIs / CDNs

| Service         | URL                                                                                        | Purpose                        |
|-----------------|--------------------------------------------------------------------------------------------|--------------------------------|
| Goldsky         | `api.goldsky.com/api/public/project_cmsayhv4pci4001tn55nndrki/subgraphs/dice-battle/1.0.0/gn` | Game data indexer (public)  |
| Celo Forno RPC  | `https://forno.celo.org`                                                                   | Default blockchain RPC         |
| Vercel          | `https://dice-battle-web.vercel.app`                                                       | Frontend hosting               |
| Reown AppKit    | `https://cloud.reown.com`                                                                  | WalletConnect relay (non-MiniPay fallback) |

## Fonts / Static Assets

- Fonts: `Inter` and `Space Grotesk` loaded via `next/font/google` (self-hosted by Next.js, no runtime CDN calls)
- Images: all served from `/public/` on Vercel (no external CDN)

---

## Security Configuration

- `minimum-release-age = 604800` (7 days) in `.npmrc`
- `ignore-scripts = true` in `.npmrc`
- Lockfile (`pnpm-lock.yaml`) committed; CI uses `--frozen-lockfile`
- No `signMessage` / `personal_sign` — MiniPay auto-connects, no manual signature prompts

---

## Compliance Checklist

- [x] HTTPS (Vercel provides TLS)
- [x] Auto-connect in MiniPay — no "Connect Wallet" button shown inside MiniPay
- [x] No `signMessage` / `personal_sign` calls
- [x] Error handling with JSON-RPC error codes (`error.code`)
- [x] Terms of Service at `/legal/terms`
- [x] Privacy Policy at `/legal/privacy`
- [x] Support URL in footer (Telegram)
- [x] Mobile viewport — app is `max-w-md` (448px), optimized for 360×720+
- [x] Celo Mainnet (Chain ID 42220)
- [x] CIP-64 fee abstraction (gas paid in stablecoins via MiniPay)
- [x] Contract verified on Celoscan (already verified)
- [~] PageSpeed mobile score: 70/100 — inherent to wagmi/viem/reown bundle (~400KB); acceptable for web3 apps
- [ ] Sample transactions per method — pending first mainnet games
- [ ] App icon 512×512 submitted

---

## How to Verify the Contract (Celoscan)

```bash
cd packages/contracts

forge verify-contract \
  0x320Ee4e931B7182eD4BFC085aaa3060895B6A6B6 \
  src/DiceBattle.sol:DiceBattle \
  --chain-id 42220 \
  --etherscan-api-key $CELOSCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(address)" 0xYOUR_FEE_RECIPIENT)
```
