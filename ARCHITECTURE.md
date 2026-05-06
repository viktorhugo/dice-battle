# Arquitectura de Dice Battle 🎲

**Descripción:** Aplicación Next.js para jugar dados 1v1 en Celo usando MiniPay. Los jugadores apuestan stablecoins, revelan secretos y el contrato inteligente determina el ganador usando entropía en cadena. El historial de partidas y las estadísticas de jugadores son indexados por Envio y expuestos vía GraphQL.

---

## Tabla de Contenidos

1. [Estructura de carpetas](#1-estructura-de-carpetas)
2. [Flujo de carga y providers](#2-flujo-de-carga-y-providers)
3. [Conexión de wallet y MiniPay](#3-conexión-de-wallet-y-minipay)
4. [Páginas](#4-páginas)
   - [Home](#41-home)
   - [Crear sala](#42-crear-sala)
   - [Unirse a sala](#43-unirse-a-sala)
   - [Juego](#44-juego)
   - [Salas abiertas](#45-salas-abiertas)
   - [Perfil de jugador](#46-perfil-de-jugador)
   - [Leaderboard](#47-leaderboard)
5. [Componentes clave](#5-componentes-clave)
6. [Lógica del secreto](#6-lógica-del-secreto)
7. [Envio Indexer](#7-envio-indexer)
8. [Lib y utilidades](#8-lib-y-utilidades)
9. [Flujo completo Alice vs Bob](#9-flujo-completo-alice-vs-bob)
10. [Variables de entorno](#10-variables-de-entorno)
11. [Seguridad](#11-seguridad)

---

## 1. Estructura de carpetas

```
apps/web/
├── app/
│   ├── layout.tsx              # Layout raíz, max-w-md, metadataBase
│   ├── page.tsx                # Home + LiveStats banner
│   ├── globals.css             # Tailwind + shadcn CSS vars
│   ├── create/
│   │   └── page.tsx            # Crear sala
│   ├── join/[roomId]/
│   │   └── page.tsx            # Unirse a sala (Player B)
│   ├── game/[roomId]/
│   │   ├── layout.tsx          # generateMetadata con og:image dinámico
│   │   └── page.tsx            # Vista del juego + reveal + Share button
│   ├── rooms/
│   │   └── page.tsx            # Salas abiertas (indexer)
│   ├── profile/[address]/
│   │   └── page.tsx            # Perfil de jugador (indexer)
│   ├── leaderboard/
│   │   └── page.tsx            # Leaderboard global (indexer)
│   └── api/
│       └── og/[roomId]/
│           └── route.tsx       # Edge route — Open Graph image dinámica
├── components/
│   ├── WalletBar.tsx           # Estado de wallet + avatar → /profile
│   ├── game/
│   │   ├── DiceAnimation.tsx   # Animación de dados por fases (Framer Motion)
│   │   └── SecretBackupModal.tsx # Modal de respaldo del secreto (shadcn Dialog)
│   ├── social/
│   │   └── LiveStats.tsx       # Banner de stats en vivo (indexer, refresh 30s)
│   └── ui/
│       ├── button.tsx          # shadcn Button
│       ├── dialog.tsx          # shadcn Dialog
│       ├── identicon.tsx       # Avatar SVG determinístico (minidenticons)
│       ├── skeleton.tsx        # shadcn Skeleton
│       └── spinner.tsx         # Spinner de carga
├── config/
│   └── wagmi.ts                # Wagmi + Reown AppKit
├── hooks/
│   ├── useMiniPay.ts           # Detecta y auto-conecta MiniPay
│   └── useErrorToast.ts        # Toast de errores
└── lib/
    ├── abi.ts                  # ABI del contrato (auto-sincronizado)
    ├── commitment.ts           # generate / compute / store / load / clear secret
    ├── constants.ts            # TOKENS, ROOM_STATE, GAME_ADDRESS, ERC20_ABI
    ├── indexer.ts              # Cliente GraphQL + queries tipadas
    ├── logger.ts               # Logger desactivado en producción
    └── utils.ts                # cn, truncateAddress, getTokenSymbol
```

---

## 2. Flujo de carga y providers

`app/layout.tsx` envuelve todo en `<Providers>` con ancho máximo de 28rem (diseño mobile-first / MiniPay).

`components/Providers.tsx`:
- **WagmiProvider** — chains: `[celo, celoSepolia]`, connector: `injected`, transports: HTTP Forno
- **QueryClientProvider** — staleTime 10s, refetchOnWindowFocus: false
- **AppKit** (Reown) — solo para entornos fuera de MiniPay

---

## 3. Conexión de wallet y MiniPay

### `hooks/useMiniPay.ts`

Detecta `window.ethereum.isMiniPay`. Si es verdadero, auto-conecta con el conector `injected`. Devuelve:

```ts
{ isMiniPay, hasInjected, address, isConnected, checked }
```

### `components/WalletBar.tsx`

```
[AppKitButton] [●avatar]         Celo Sepolia
```

- En MiniPay: muestra badge verde "MiniPay" en lugar del AppKitButton
- Cuando hay wallet conectada: muestra un `Identicon` de 28px que linkea a `/profile/[address]`
- Skeleton mientras `checked` es false

---

## 4. Páginas

### 4.1 Home

`app/page.tsx` — Links a `/create`, `/rooms`, `/leaderboard` + descripción de "How it works".

Incluye el banner `<LiveStats />` que muestra en tiempo real (refresh cada 30s vía indexer):
- **Open rooms** — salas con `state = OPEN`
- **Games today** — partidas creadas en las últimas 24h
- **All-time** — total de partidas resueltas/tied

### 4.2 Crear sala

`app/create/page.tsx`

1. Selecciona token (cUSD / USDT / USDC) y stake (presets + custom)
2. Verifica y aprueba allowance ERC-20 si es necesario
3. Genera `secret` (32 bytes, Web Crypto API) y `commitment = keccak256(secret, address)`
4. Llama `createRoom(token, stake, commitment)` → extrae `roomId` del evento `RoomCreated`
5. Guarda el secreto en localStorage con `storeSecret(roomId, secret)`
6. Redirige a `/game/[roomId]`

### 4.3 Unirse a sala

`app/join/[roomId]/page.tsx`

- Lee la sala del contrato con `useReadContract`
- **Player A** ve el estado de la sala + botón para copiar el link + `SecretBackupModal` si no ha hecho backup del secreto
- **Player B** ve stake, host, indicador de allowance y botón "Match [stake]"
- Al unirse exitosamente redirige a `/game/[roomId]`
- Polling cada 3s: si ya está en estado MATCHED, Player A es redirigido automáticamente

### 4.4 Juego

`app/game/[roomId]/` tiene dos archivos:

**`layout.tsx`** (server component) — exporta `generateMetadata` con Open Graph dinámico:
```ts
openGraph.images → ["/api/og/${roomId}"]  // OG image con dados y resultado
twitter.card     → "summary_large_image"
```
Necesario porque `page.tsx` es "use client" y no puede exportar `generateMetadata`.

**`page.tsx`** (client component):
- Lee la sala del contrato con polling cada 3s
- Muestra `DicePair` con animación cuando hay rolls disponibles
- **Player A + MATCHED**: botón "Roll the dice" → llama `reveal(roomId, secret)` → limpia localStorage
- **Player B + MATCHED**: espera y puede llamar `claimExpired` si superó la ventana de 200 bloques
- Resultados: Won / Lost / Tied / Expired con colores y montos
- Botones **"Share result"** + **"Play again"** al terminar el juego:
  - Share usa `navigator.share` (nativo en MiniPay/mobile) con fallback a clipboard
  - Comparte la URL `/game/[roomId]` que despliega la OG card en Farcaster, Twitter, etc.

**`/api/og/[roomId]`** (Edge route) — genera imagen 1200×630 con `next/og`:
- Muestra dados con highlight amarillo al ganador, totales por jugador, addresses truncadas
- Estados: RESOLVED (dados + winner), TIED (dados), OPEN/MATCHED (placeholder), error (fallback genérico)
- Prize calculado como `stake × 1.96` (2% fee)
- `export const runtime = "edge"` — cold start ~0ms, desplegable en Vercel Edge Network

### 4.5 Salas abiertas

`app/rooms/page.tsx`

Query al indexer: `Room(where: { state: { _eq: "OPEN" } }, order_by: { createdAt: desc })`. Cada fila linkea a `/join/[id]`. Skeleton durante carga.

### 4.6 Perfil de jugador

`app/profile/[address]/page.tsx`

Query `PlayerProfile($id)` al indexer — trae `Player_by_pk` + últimas 10 partidas resueltas/tied/expired.

Secciones:
- **Avatar** (`Identicon` 48px) + dirección con botón copiar al clipboard
- **Streak badge** si `currentStreak > 0`
- **Stat cards**: games · wins · win rate% · streak🔥
- **OutcomeBar**: barra proporcional verde/rojo/amarillo (W/L/T)
- **Dice stats**: avg die, mejor mano, número de la suerte — calculados de los rolls en el historial
- **Duración promedio** de partida (`resolvedAt - createdAt`)
- **Historial reciente**: cada fila linkea a `/game/[id]`

### 4.7 Leaderboard

`app/leaderboard/page.tsx`

Tres tabs:
- **All-time**: query directo a `Player(order_by: { wins: desc })` — eficiente, pre-agregado
- **Today / Week**: query `Room` filtrado por `resolvedAt >= since`, agregación en cliente por dirección

Sorts client-side: **Wins** / **Win Rate** (tiebreak: wins) / **Volume**.

Cada fila: medalla 🥇🥈🥉 o número, `Identicon` 28px, dirección truncada, métrica principal + secundaria. Click → `/profile/[address]`.

---

## 5. Componentes clave

### `DiceAnimation` / `DicePair`

`components/game/DiceAnimation.tsx` — animación en 4 fases con Framer Motion:
1. **Chaos** (0–500ms): números random cada 50ms
2. **Slowdown** (500–1150ms): pasos fijos decreciendo velocidad
3. **Settle** (1200ms): muestra el valor final con spring bounce
4. Prop `delay` para escalonar el segundo dado

`DicePair` envuelve dos `DiceAnimation` con un contador de total (0 → suma, 1500–2000ms).

### `SecretBackupModal`

`components/game/SecretBackupModal.tsx` — `shadcn Dialog` que se muestra automáticamente en `/join/[roomId]` cuando Player A no ha hecho backup de su secreto. Auto-dismiss a los 10s. Guarda flag en localStorage con `markSeenBackup(roomId)`.

### `Identicon`

`components/ui/identicon.tsx` — usa `minidenticons` para generar un SVG determinístico a partir de la dirección. SSR-safe, cero dependencias de canvas. Usado en `WalletBar`, perfil y leaderboard.

---

## 6. Lógica del secreto

`lib/commitment.ts`:

| Función | Descripción |
|---------|-------------|
| `generateSecret()` | 32 bytes aleatorios via `crypto.getRandomValues` |
| `computeCommitment(secret, player)` | `keccak256(abi.encode(secret, player))` — debe coincidir con el contrato |
| `storeSecret(roomId, secret)` | `localStorage.setItem("dice-battle:secret:{roomId}", secret)` |
| `loadSecret(roomId)` | Lee del localStorage |
| `clearSecret(roomId)` | Elimina tras revelar |
| `hasSeenBackup(roomId)` | Verifica si Player A ya hizo backup del secreto |
| `markSeenBackup(roomId)` | Marca el backup como visto |

**El secreto nunca sale del dispositivo hasta que Player A llama `reveal`.**

---

## 7. Envio Indexer

`packages/envio-indexer/`

### Schema (`schema.graphql`)

**Tablas de eventos crudos** (una fila por evento):
`DiceBattle_RoomCreated`, `DiceBattle_RoomJoined`, `DiceBattle_RoomResolved`, `DiceBattle_RoomTied`, `DiceBattle_RoomExpiredClaim`, `DiceBattle_RoomCancelled`

**Entidades agregadas:**

```graphql
type Room {
  id: ID!          # roomId como string
  state: String!   # OPEN | MATCHED | RESOLVED | TIED | EXPIRED | CANCELLED
  playerA: String!
  playerB: String
  token: String!
  stake: BigInt!
  winner: String
  rollA1: Int  rollA2: Int  rollB1: Int  rollB2: Int
  createdAt: BigInt!
  resolvedAt: BigInt
  txCreate: String!
  txResolve: String
}

type Player {
  id: ID!              # dirección en minúsculas
  totalGames: BigInt!
  wins: BigInt!  losses: BigInt!  ties: BigInt!
  totalVolume: BigInt!
  totalWon: BigInt!  totalLost: BigInt!
  lastGameAt: BigInt!
  currentStreak: BigInt!  longestStreak: BigInt!
}
```

### Handlers (`src/EventHandlers.ts`)

Cada evento actualiza tanto la entidad `Room` como los `Player` involucrados:

| Evento | Room | Player |
|--------|------|--------|
| `RoomCreated` | state=OPEN | — |
| `RoomJoined` | state=MATCHED, playerB | — |
| `RoomResolved` | state=RESOLVED, rolls, txResolve | winner: wins++, streak++, longestStreak; loser: losses++, streak=0, totalLost |
| `RoomTied` | state=TIED, rolls | ambos: ties++, streak=0 |
| `RoomExpiredClaim` | state=EXPIRED | — |
| `RoomCancelled` | state=CANCELLED | — |

### Queries usadas en el frontend (`lib/indexer.ts`)

| Función | Query | Usado en |
|---------|-------|----------|
| `getOpenRooms(limit)` | `Room(where: state=OPEN, order: createdAt desc)` | `/rooms` |
| `getPlayerProfile(address)` | `Player_by_pk` + `Room` (últimas 10) | `/profile/[address]` |
| `getLeaderboardAllTime(limit)` | `Player(order: wins desc)` | `/leaderboard` All-time |
| `getLeaderboardPeriod(since)` | `Room(where: resolvedAt >= since)` → agrega en cliente | `/leaderboard` Today/Week |

---

## 8. Lib y utilidades

### `lib/constants.ts`

- `TOKENS` — addresses de cUSD, USDT, USDC por red
- `getTokenDecimals(address)` — decimales por token (6 o 18)
- `ROOM_STATE` — enum `{ NONE:0, OPEN:1, MATCHED:2, RESOLVED:3, EXPIRED:4 }`
- `GAME_ADDRESS`, `GAME_DEPLOY_BLOCK`, `CHAIN_ID`
- `ERC20_ABI` — approve / allowance / balanceOf / decimals

### `lib/utils.ts`

- `cn(...classes)` — clsx + tailwind-merge
- `truncateAddress(address)` — `0x1234…5678`
- `getTokenSymbol(tokenAddress)` — dirección → símbolo ("cUSD", "USDT"…)
- `NETWORK_LABEL` — `{ celo: "Celo Mainnet", celo_sepolia: "Celo Sepolia" }`

---

## 9. Flujo completo Alice vs Bob

```
1. Alice entra → MiniPay auto-conecta → WalletBar muestra avatar
2. Alice → /create → elige cUSD 1.00 → approve → createRoom → /game/5
3. Alice comparte /join/5 con Bob
4. Bob → /join/5 → ve sala abierta → approve → joinRoom → /game/5
5. Alice ve estado MATCHED + botón "Roll the dice"
   → reveal(5, secret) → contrato calcula rolls → RoomResolved emitido
6. Ambos ven animación de dados + resultado (Won / Lost / Tied)
7. Sala queda en estado RESOLVED → indexer actualiza Room y Player
8. En /leaderboard Alice aparece con wins++ y streak++
9. En /profile/[alice] se ve la partida en el historial con link a /game/5
```

---

## 10. Variables de entorno

```bash
# apps/web/.env.local
NEXT_PUBLIC_GAME_ADDRESS=0x...          # Dirección del contrato DiceBattle
NEXT_PUBLIC_NETWORK=celo_sepolia        # "celo" | "celo_sepolia"
NEXT_PUBLIC_REOWN_PROJECT_ID=...        # ID del proyecto en Reown (AppKit)
NEXT_PUBLIC_GAME_DEPLOY_BLOCK=...       # Bloque de deploy (para eventos históricos)
NEXT_PUBLIC_INDEXER_URL=http://localhost:8080/v1/graphql  # Endpoint GraphQL del indexer
```

---

## 11. Seguridad

- El secreto **nunca** sale del dispositivo hasta que Player A llama `reveal`
- Solo el hash (commitment) se envía al contrato en `createRoom`
- `block.prevrandao` no era conocido cuando A hizo el commitment → A no puede predecir el resultado
- Player B no puede influir el resultado → el commitment estaba bloqueado antes de que B se uniera
- Si Player A no revela, Player B puede reclamar el pot con `claimExpired` (ventana de 200 bloques)
- 2% de fee del contrato desincentiva spam
- Todos los cálculos de aleatoriedad ocurren en el contrato, no en el cliente
