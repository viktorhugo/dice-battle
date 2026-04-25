# Arquitectura de Dice Battle 🎲

**Descripción:** Aplicación Next.js para jugar dados 1v1 en Celo usando MiniPay. Los jugadores apuestan stablecoins, revelan secretos y el contrato inteligente determina el ganador usando entropía en cadena.

---

## 📋 Tabla de Contenidos

1. [Estructura Básica](#estructura-básica)
2. [Flujo de Carga](#flujo-de-carga)
3. [Conexión de Wallet y MiniPay](#conexión-de-wallet-y-minipay)
4. [Página Inicial](#página-inicial)
5. [Crear Sala](#crear-sala)
6. [Unirse a Sala](#unirse-a-sala)
7. [Página del Juego](#página-del-juego)
8. [Lógica del Compromiso Secreto](#lógica-del-compromiso-secreto)
9. [Conexión con Contrato y Tokens](#conexión-con-contrato-y-tokens)
10. [Flujo Completo](#flujo-completo)

---

## 1. Estructura Básica

La app está en `apps/web` usando Next.js App Router.

### Carpetas principales

```
apps/web/
├── app/
│   ├── layout.tsx              # Layout raíz
│   ├── page.tsx                # Página inicio
│   ├── globals.css
│   ├── create/
│   │   └── page.tsx            # Crear sala
│   ├── game/
│   │   └── [roomId]/
│   │       └── page.tsx        # Vista del juego
│   └── join/
│       └── [roomId]/
│           └── page.tsx        # Unirse a sala
├── components/
│   ├── Providers.tsx           # Providers globales (Wagmi + React Query)
│   └── WalletBar.tsx           # Barra de wallet
├── hooks/
│   └── useMiniPay.ts           # Detecta y conecta MiniPay
└── lib/
    ├── abi.ts                  # ABI del contrato DiceBattle
    ├── commitment.ts           # Lógica de secreto
    ├── constants.ts            # Constantes (direcciones, ABIs)
    └── wagmi.ts                # Configuración de Wagmi
```

---

## 2. Flujo de Carga

### `app/layout.tsx`

Punto de entrada de la aplicación. Define la estructura HTML raíz.

```typescript
- Importa Providers
- Crea <html lang="es">
- Aplica estilos CSS globales
- Envuelve contenido en <Providers>
- Limita ancho máximo a md (28rem)
```

### `components/Providers.tsx`

Configura contextos globales:

```typescript
- WagmiProvider: gestiona conexión a blockchain
  ├── chains: [celo, celoSepolia]
  ├── connectors: [injected] (solo MiniPay)
  └── transports: HTTP a Celo Forno

- QueryClientProvider: cachea llamadas de lectura
  ├── staleTime: 10 segundos
  └── refetchOnWindowFocus: false
```

---

## 3. Conexión de Wallet y MiniPay

### `hooks/useMiniPay.ts`

Auto-detecta y conecta MiniPay:

```typescript
// 1. En cliente, verifica window.ethereum.isMiniPay
// 2. Si es true, conecta automáticamente con injected connector
// 3. Devuelve estado:
{
  isMiniPay: boolean
  address: `0x${string}` | undefined
  isConnected: boolean
  checked: boolean  // true cuando termina detección
}
```

**Importante:** 
- MiniPay inyecta `window.ethereum` automáticamente
- No necesita WalletConnect ni otras opciones
- La app solo usa `injected` connector

### `components/WalletBar.tsx`

Muestra estado de conexión:

```
┌─────────────────────────────────────────┐
│ 🔵 MiniPay  0x1234…5678  | Celo mainnet │
└─────────────────────────────────────────┘
```

- Muestra "Loading..." mientras detecta
- Abreviatura de dirección: `0x1234…5678`
- Indicador visual de MiniPay

---

## 4. Página Inicial

**Archivo:** `app/page.tsx`

Pantalla principal del juego.

### Contenido

```
🎲 DESAFÍO COP

"PvP dice battle. Stake stablecoins, 
 roll the dice, winner takes the pot."

┌────────────────────┐
│ Create a room      │ → /create
└────────────────────┘

┌────────────────────┐
│ Browse open rooms  │ → /rooms
└────────────────────┘

HOW IT WORKS:
1. Create a room with your stake
2. Share the link with a friend
3. Reveal your secret
4. The contract rolls two dice
5. Higher roll wins (2% fee)
```

### Componentes usados

- `WalletBar`: muestra estado de MiniPay
- Links internos a crear/unirse

---

## 5. Crear Sala

**Archivo:** `app/create/page.tsx`

Flujo para iniciar un juego.

### UI de Selección

```
┌─────────────────────┐
│ Token               │
├─────────────────────┤
│ [cUSD]  [USDT]      │
└─────────────────────┘

┌─────────────────────┐
│ Stake (presets)     │
├─────────────────────┤
│ [0.50] [1.00] ... │
│ [Custom amount...]  │
└─────────────────────┘

┌─────────────────────┐
│ Your stake: 1 cUSD  │
│ Opp matches: 1 cUSD │
│ If you win: ~1.96   │
│ Fee: 2%             │
└─────────────────────┘
```

### Flujo de Transacciones

#### Paso 1: Verificar wallet y contrato
```typescript
if (!address || !publicClient) → Error
if (GAME_ADDRESS === 0x0000...) → Error
```

#### Paso 2: Preparar cantidad
```typescript
stakeWei = parseUnits(stake, 18)  // Convierte a wei
```

#### Paso 3: Verificar y aprobar token (si es necesario)
```typescript
allowance = readContract(token, "allowance", [userAddress, GAME_ADDRESS])

if (allowance < stakeWei) {
  txHash = writeContract(token, "approve", [GAME_ADDRESS, stakeWei])
  waitForTransactionReceipt(txHash)
  // Estado: "Approving…"
}
```

#### Paso 4: Generar secreto y compromiso
```typescript
secret = generateSecret()  
  // 32 bytes aleatorios del navegador

commitment = computeCommitment(secret, userAddress)
  // keccak256(abi.encode(secret, userAddress))
  // Se envía al contrato (sin revelar el secret)
```

#### Paso 5: Crear sala en contrato
```typescript
txHash = writeContract(
  GAME_ADDRESS,
  "createRoom",
  [tokenAddress, stakeWei, commitment]
)
receipt = waitForTransactionReceipt(txHash)
// Estado: "Creating room…"
```

#### Paso 6: Extraer roomId del evento
```typescript
for (const log of receipt.logs) {
  decoded = decodeEventLog(log)
  if (decoded.eventName === "RoomCreated") {
    roomId = decoded.args.roomId
    break
  }
}
```

#### Paso 7: Guardar secreto localmente
```typescript
storeSecret(roomId, secret)
  // localStorage.setItem("dice-battle:secret:{roomId}", secret)
  // ⚠️ SOLO en el dispositivo del creador
```

#### Paso 8: Redirigir
```typescript
router.push(`/game/${roomId}`)
// Estado: "Done!"
```

### Estados de Botón
- `idle`: "Connect wallet" | "Create and stake"
- `approving`: "Approving…"
- `creating`: "Creating room…"
- `done`: "Done!"

---

## 6. Unirse a Sala

**Archivo:** `app/join/[roomId]/page.tsx`

Pantalla para unirse a una sala existente.

### Carga Inicial

```typescript
// Lee la sala del contrato
room = readContract(
  GAME_ADDRESS,
  "rooms",
  [BigInt(roomId)]
)

// room estructura:
{
  playerA: address
  playerB: address
  token: address
  stake: BigInt
  state: number (0-4)
}
```

### Estados de Sala

| Estado | Nombre | Acción |
|--------|--------|--------|
| 1 | Open | Otro puede unirse |
| 2 | Matched | Ambos están dentro |
| 3 | Resolved | Juego terminado |
| 4 | Expired | Revelar expiró |

### Interfaz por Estado

#### Si eres el creador (playerA)
```
"You created this room. Share the link with your opponent."
┌──────────────────┐
│ Copy link        │
└──────────────────┘
```

#### Si eres otro jugador (playerB) y sala abierta
```
Host:   0x1234…5678
Stake:  1.00 cUSD
State:  Open

┌────────────────────────────────┐
│ Match 1.00 cUSD                │
└────────────────────────────────┘
```

### Flujo de Unirse

```typescript
// 1. Verificar allowance
allowance = readContract(token, "allowance", [userAddress, GAME_ADDRESS])

// 2. Aprobar si es necesario
if (allowance < stake) {
  txHash = writeContract(token, "approve", [GAME_ADDRESS, stake])
  waitForTransactionReceipt(txHash)
}

// 3. Unirse a sala
txHash = writeContract(
  GAME_ADDRESS,
  "joinRoom",
  [BigInt(roomId)]
)
waitForTransactionReceipt(txHash)

// 4. Redirigir a juego
router.push(`/game/${roomId}`)
```

---

## 7. Página del Juego

**Archivo:** `app/game/[roomId]/page.tsx`

Pantalla principal donde se muestra el resultado.

### Datos que Carga

```typescript
room = readContract(GAME_ADDRESS, "rooms", [roomId])

// Si state === 3 (Resolved):
//   Busca eventos en los últimos 10,000 bloques
//   Decodifica: RoomResolved | RoomTied | RoomExpiredClaim
```

### Interfaz de Dados

```
        🎲          🎲
      [6]  vs    [4]

      Host    vs    Guest
```

Usando componente `<DieBox value={rollA} label="Host" />`.

### Resultados Posibles

#### Ganador
```
✅ You won! 🎉
+1.96 cUSD
```

#### Perdedor
```
❌ Better luck next time
Opponent took 1.96 cUSD
```

#### Empate
```
🟡 It's a tie!
Both players refunded their stake.
```

#### Expirado
```
⏱️ Claimed as expired
Host did not reveal in time.
```

### Acciones Disponibles

#### Si eres playerA y sala emparejada (state === 2)
```
┌──────────────────────────┐
│ 🎲 Roll the dice         │
│ (Reveal your secret)     │
└──────────────────────────┘
```

**Qué hace:**
1. Carga el secreto del localStorage
2. Llama a `reveal(roomId, secret)`
3. El contrato calcula el resultado
4. Se emite evento `RoomResolved` o `RoomTied`
5. Se limpia el localStorage con `clearSecret()`

#### Si playerA no revela a tiempo
```
┌──────────────────────────┐
│ 💰 Claim as expired      │
└──────────────────────────┘
```

**Qué hace:**
- Solo disponible para playerB
- Llama a `claimExpired(roomId)`
- El contrato devuelve el stake a playerB

### Manejo de Errores

```
Si el secreto no está en localStorage:
"Could not find your secret locally. 
 It must be on the device you used to create the room."
```

---

## 8. Lógica del Compromiso Secreto

**Archivo:** `lib/commitment.ts`

Implementa commit-reveal pattern para evitar que el creador vea el rol del otro antes de revelar.

### `generateSecret()`

```typescript
// Genera 32 bytes aleatorios
export function generateSecret(): Hex {
  const buf = new Uint8Array(32)
  crypto.getRandomValues(buf)
  return "0x" + buf.toString(16)  // → "0xab12cd..."
}
```

### `computeCommitment(secret, player)`

```typescript
// Calcula: keccak256(abi.encode(secret, player))
export function computeCommitment(secret: Hex, player: Address): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "address" }],
      [secret, player]
    )
  )
}

// Ejemplo:
// secret = "0xabc123..."
// player = "0x1234..."
// → "0xdef456..." (hash)
```

**IMPORTANTE:** Este hash DEBE coincidir exactamente con la función `computeCommitment` del contrato Solidity.

### `storeSecret(roomId, secret)`

```typescript
// Guarda en localStorage del navegador
localStorage.setItem(
  `dice-battle:secret:${roomId}`, 
  secret
)

// ⚠️ Solo disponible en el dispositivo del creador
// Si se borra antes de revelar → playerA no puede jugar
```

### `loadSecret(roomId)`

```typescript
// Carga de localStorage
return localStorage.getItem(`dice-battle:secret:${roomId}`)
```

### `clearSecret(roomId)`

```typescript
// Limpia después de revelar
localStorage.removeItem(`dice-battle:secret:${roomId}`)
```

### Por qué existe este patrón

1. **Privacidad:** El creador no puede ver qué número salió del otro jugador antes de revelar.
2. **Fairness:** Ambos jugadores revelan simultáneamente (en el mismo bloque).
3. **On-chain:** El contrato verifica `keccak256(secret, player) === commitment`.

---

## 9. Conexión con Contrato y Tokens

### `lib/constants.ts`

```typescript
// Direcciones de stablecoins en Celo mainnet
TOKENS = {
  cUSD:  "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  USDT:  "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e"
}

// Dirección del contrato DiceBattle
GAME_ADDRESS = process.env.NEXT_PUBLIC_GAME_ADDRESS
              || "0x0000000000000000000000000000000000000000"

// Red
NETWORK = process.env.NEXT_PUBLIC_NETWORK || "celo"
CHAIN_ID = NETWORK === "celo" ? 42_220 : 11_142_220

// ABI mínimo de ERC20 (approve, allowance, balanceOf, decimals)
ERC20_ABI = [...]
```

### `lib/abi.ts`

Contiene el ABI completo de `DiceBattle` generado automáticamente.

**Funciones principales:**
- `createRoom(token, stake, commitment) → roomId`
- `joinRoom(roomId)`
- `reveal(roomId, secret)`
- `claimExpired(roomId)`
- `rooms(roomId) → (playerA, playerB, token, stake, matchedAtBlock, commitment, state)`

**Eventos:**
- `RoomCreated(roomId)`
- `RoomResolved(roomId, winner, rollA, rollB, payout, fee)`
- `RoomTied(roomId, rollA, rollB)`
- `RoomExpiredClaim(roomId)`

### `lib/wagmi.ts`

Configura la conexión Web3.

```typescript
export const wagmiConfig = createConfig({
  // Cadenas soportadas
  chains: [celo, celoSepolia],
  
  // Solo injected (MiniPay)
  connectors: [injected({ shimDisconnect: true })],
  
  // Transports HTTP
  transports: {
    [celo.id]: http(
      process.env.NEXT_PUBLIC_RPC_URL 
      || "https://forno.celo.org"
    ),
    [celoSepolia.id]: http(
      "https://forno.celo-sepolia.celo-testnet.org"
    ),
  },
  
  // Soporte para SSR
  ssr: true,
})
```

**Importante:** 
- **Nunca** agregar ethers.js (MiniPay solo soporta viem)
- Solo usar `injected` connector (MiniPay la proporciona)

---

## 10. Flujo Completo

### Escenario: Alice vs Bob

```
1. ALICE ENTRA A LA HOME
   ├─ useMiniPay detecta MiniPay
   ├─ Se auto-conecta
   └─ WalletBar muestra: "🔵 MiniPay  0x1234…5678"

2. ALICE CREA SALA (/create)
   ├─ Elige: cUSD, stake 1
   ├─ Presiona "Create and stake"
   ├─ [Approving] → txHash de approve
   ├─ Genera secret en cliente: "0xabc123..."
   ├─ Calcula commitment: keccak256(secret, alice)
   ├─ [Creating room] → txHash de createRoom
   ├─ Lee evento RoomCreated → roomId = 5
   ├─ Guarda secret en localStorage
   └─ Redirige a /game/5

3. ALICE COMPARTE LINK
   └─ alice.minipay.local/join/5

4. BOB ENTRA A SALA (/join/5)
   ├─ useMiniPay lo auto-conecta
   ├─ Lee room #5 del contrato
   ├─ Ve: "playerA: 0x1234…, stake: 1 cUSD, state: Open"
   ├─ Como no es el creador, ve botón "Match 1 cUSD"
   ├─ Presiona
   ├─ [Approving] → txHash
   ├─ [Joining] → txHash de joinRoom
   ├─ Redirige a /game/5

5. EN EL JUEGO (/game/5)
   ESTADO ANTES DE REVELAR:
   
   Alice ve:
   ├─ Dos dados vacíos (?)
   ├─ Estado: Matched
   └─ Botón: "🎲 Roll the dice"
   
   Bob ve:
   ├─ Dos dados vacíos (?)
   ├─ Estado: Matched
   └─ Texto: "Waiting for host to reveal..."

6. ALICE REVELA
   ├─ Presiona "Roll the dice"
   ├─ Carga secret del localStorage
   ├─ Llama reveal(roomId, secret)
   ├─ El contrato valida: keccak256(secret, alice) === commitment
   ├─ Calcula dos dados aleatorios onchain
   ├─ Emite: RoomResolved(5, alice, 6, 4, payout, fee)
   └─ Limpia localStorage

7. RESULTADOS FINALES
   Alice ve:
   ├─ Dos dados: [6] vs [4]
   ├─ Texto: "✅ You won! 🎉"
   └─ Payout: "+1.96 cUSD"
   
   Bob ve:
   ├─ Dos dados: [6] vs [4]
   ├─ Texto: "❌ Better luck next time"
   └─ Info: "Opponent took 1.96 cUSD"

CASO ALTERNATIVO - ALICE NO REVELA A TIEMPO:

7b. BOB RECLAMA EXPIRACIÓN
    ├─ Han pasado > REVEAL_WINDOW_BLOCKS
    ├─ Bob presiona "Claim as expired"
    ├─ Llama claimExpired(roomId)
    ├─ El contrato devuelve 1 cUSD a Bob
    ├─ Emite: RoomExpiredClaim(5)
    └─ Bob ve: "Claimed as expired - Host did not reveal in time"
```

---

## 📦 Dependencias Clave

```json
{
  "dependencies": {
    "next": "^16",
    "react": "^19",
    "typescript": "^6",
    "wagmi": "^3",  // Web3 abstraction
    "viem": "^2",   // Ethereum utilities
    "@tanstack/react-query": "^5",  // Data fetching cache
    "tailwindcss": "^3",  // Estilos
    "postcss": "^8"
  }
}
```

---

## 🌐 Variables de Entorno

```bash
# Dirección del contrato DiceBattle
NEXT_PUBLIC_GAME_ADDRESS=0x...

# Red (celo o celo_sepolia)
NEXT_PUBLIC_NETWORK=celo

# RPC URL personalizada (opcional)
NEXT_PUBLIC_RPC_URL=https://forno.celo.org
```

---

## 🔐 Seguridad

- ✅ El secreto **nunca** se envía al contrato
- ✅ Solo se envía el hash (commitment)
- ✅ El jugador creador es el único que puede revelar
- ✅ Expiración automática si no revela a tiempo
- ✅ Fee del 2% protege contra spam
- ✅ Usa Web Crypto API para aleatoriedad

---

## 📝 Resumen Ejecutivo

| Aspecto | Detalles |
|---------|----------|
| **Framework** | Next.js 16 (App Router) |
| **Blockchain** | Celo Network |
| **Wallet** | MiniPay (auto-connect) |
| **Tokens** | cUSD, USDT |
| **Patrón** | Commit-Reveal (secreto local) |
| **Estado** | Almacenado en contrato + eventos |
| **Cache** | React Query con staleTime 10s |
| **Estilos** | Tailwind CSS + tema oscuro |

