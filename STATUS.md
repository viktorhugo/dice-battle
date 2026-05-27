
# Dice Battle — Task Board

> Última actualización: 2026-05-27

---

## Estado rápido

| Área | Estado |
| --- | --- |
| Core del juego (contrato + front) | ✅ Production-ready |
| Indexer | ⚠️ Solo Sepolia — mainnet comentado |
| DailyTournament deploy mainnet | ❌ Pendiente |
| Cron `setTopWinners` | ❌ No existe |
| Self Identity | ❌ No implementado |
| ENS / Name resolution | ❌ No implementado |

---

## 🔴 Crítico — bloqueante para producción

- ✅ **Indexer Envio mainnet activado** — `config.yaml` bloque `id: 42220` configurado y corriendo
- ✅ **Variables de entorno producción en Vercel** — `GAME_ADDRESS`, `NETWORK=celo`, `INDEXER_URL`, `GAME_DEPLOY_BLOCK` seteados

---

## 🟠 Importante

- [ ] **Deployar DailyTournament en mainnet**

  ```bash
  pnpm --filter contracts deploy:mainnet
  ```

  Luego setear `NEXT_PUBLIC_TOURNAMENT_ADDRESS` en Vercel.

- [ ] **Implementar cron `setTopWinners` — 00:00 UTC diario**
  - Opción A: Vercel Cron (gratis, 1/día) en `app/api/cron/tournament/route.ts`
  - Opción B: GitHub Actions `schedule: cron('0 0 * * *')`
  - Lógica: `getLeaderboardPeriod(yesterdayMidnight)` → top-3 → `setTopWinners(dayId, addrs, wins)`

- [ ] **Agregar link a `/tournament` en el home** — la página existe pero es inaccesible sin URL directa

---

## 🆔 Self Identity — Integración completa

Self Protocol (self.xyz) permite verificar identidad (pasaporte, edad, nacionalidad) con ZK proofs sin revelar datos. En el juego: players verificados obtienen badge, acceso a salas premium o torneos exclusivos.

### Setup

- [ ] **Instalar SDK**

  ```bash
  pnpm add @selfxyz/core @selfxyz/qrcode
  ```

- [ ] **Crear componente `SelfVerifyModal`**
  - Mostrar QR code que abre la Self app
  - Self app lee el pasaporte NFC → genera ZK proof
  - Callback con `proof` y `publicSignals` al verificarse

### Verificación on-chain (recomendado)

- [ ] Llamar al verifier contract de Self en Celo mainnet

  ```ts
  // Self tiene un SelfVerificationRoot deployado en Celo
  const verified = await selfVerifier.verifyProof(proof, publicSignals, requirements);
  ```

### Verificación off-chain (alternativa rápida)

- [ ] Endpoint `/api/verify-self`

  ```ts
  // POST /api/verify-self  →  { proof, publicSignals, address }
  // Verifica el proof con @selfxyz/core y guarda en DB o firma JWT
  ```

### Persistencia del estado

- [ ] **Opción A (recomendada):** mapeo `address → verified` en contrato auxiliar
- [ ] **Opción B (rápida):** localStorage con firma del backend

### UI/UX con Self

- [ ] Badge `✓ Verified` junto a la dirección en `/profile`, `/game`, `/join`, leaderboard
- [ ] En room cards: icono escudo verde si el host está verificado
- [ ] Modal de onboarding en primera visita: _"Verifica tu identidad para ganar más"_
- [ ] Badge SVG animado (pulse sutil) en lugar de texto plano `✓`
- [ ] **Sala "Verified only" (opcional):** checkbox en `/create` + check en `/join` antes de la tx

---

## 🌐 ENS / Name Resolution — nombres en lugar de direcciones

Mostrar `vitalik.eth` en lugar de `0xd8dA…6045` en todo el app. Las direcciones EVM son idénticas en todas las chains — ENS de Ethereum mainnet funciona directamente con direcciones de Celo.

### Hook central

- [ ] **Crear `hooks/useDisplayName(address)`**

  ```ts
  // Prioridad: ENS → Celo Name Service → truncateAddress
  export function useDisplayName(address?: string): string {
    const { data: ens } = useEnsName({
      address: address as `0x${string}`,
      chainId: 1, // Ethereum mainnet — mismo address, distinta chain
    });
    return ens ?? truncateAddress(address ?? "");
  }
  ```

- [ ] **Configurar publicClient de Ethereum en wagmi config** para resolución ENS sin cambiar la chain activa del usuario

### Alternativa sin config extra — ENS API pública

- [ ] Función `resolveEns(address)` con fetch a la API de ENS Ideas

  ```ts
  // GET https://api.ensideas.com/ens/resolve/{address}
  // Retorna: { name: "vitalik.eth" | null, avatar: string | null }
  async function resolveEns(address: string): Promise<string | null> {
    const res = await fetch(`https://api.ensideas.com/ens/resolve/${address}`);
    const { name } = await res.json();
    return name;
  }
  ```

### Cache

- [ ] `Map<address, name>` en contexto global o `sessionStorage` — evitar refetch del mismo address

### Reemplazos en el app

- [ ] `components/WalletBar.tsx` — nombre del wallet conectado
- [ ] `app/game/[roomId]/page.tsx` — HOST y GUEST bajo los dados
- [ ] `app/join/[roomId]/page.tsx` — nombre del host de la sala
- [ ] `app/leaderboard/page.tsx` — cada fila del ranking
- [ ] `app/profile/[address]/page.tsx` — header del perfil
- [ ] `app/stats/page.tsx` — actividad reciente

### Extras

- [ ] **Avatar ENS** — usar como reemplazo del Identicon si existe (`useEnsAvatar`)
- [ ] **Celo Name Service** (`.celo` dominios) — investigar API pública en `cns.app`

### UI/UX con ENS

- Leaderboard: avatar + nombre en cada fila (más reconocible)
- `/game` y `/join`: card del jugador con nombre → más humano, menos técnico
- `/profile`: ENS como título principal si está disponible

---

## 🏷️ Nicknames — Sistema de apodos por jugador

Cada wallet puede registrar un apodo visible en todo el app. La prioridad de display queda: **Nickname → ENS → truncatedAddress**.

### Contrato `PlayerRegistry.sol`

- [ ] **Crear `packages/contracts/src/PlayerRegistry.sol`**

  ```solidity
  // SPDX-License-Identifier: MIT
  pragma solidity ^0.8.24;

  contract PlayerRegistry {
      mapping(address => string) private _nicknames;

      event NicknameSet(address indexed player, string nickname);

      error NicknameTooLong();
      error NicknameEmpty();

      function setNickname(string calldata name) external {
          if (bytes(name).length == 0) revert NicknameEmpty();
          if (bytes(name).length > 20) revert NicknameTooLong();
          _nicknames[msg.sender] = name;
          emit NicknameSet(msg.sender, name);
      }

      function getNickname(address player) external view returns (string memory) {
          return _nicknames[player];
      }
  }
  ```

  Reglas: 1–20 caracteres, sin restricción de charset (el frontend valida).

- [ ] **Tests `PlayerRegistry.t.sol`** — casos: set, update, empty revert, too long revert

- [ ] **Script de deploy** — `script/DeployPlayerRegistry.s.sol`

  ```bash
  pnpm --filter contracts deploy:sepolia   # test
  pnpm --filter contracts deploy:mainnet   # prod
  ```

- [ ] **Agregar `NEXT_PUBLIC_REGISTRY_ADDRESS` a `.env.local` y Vercel**

### ABI mínimo en el frontend

- [ ] **Agregar `PLAYER_REGISTRY_ABI` en `lib/constants.ts`**

  ```ts
  export const PLAYER_REGISTRY_ADDRESS = (
    process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || "0x0000000000000000000000000000000000000000"
  ) as Address;

  export const PLAYER_REGISTRY_ABI = [
    {
      name: "setNickname",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [{ name: "name", type: "string" }],
      outputs: [],
    },
    {
      name: "getNickname",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "player", type: "address" }],
      outputs: [{ type: "string" }],
    },
    {
      name: "NicknameSet",
      type: "event",
      inputs: [
        { name: "player", type: "address", indexed: true },
        { name: "nickname", type: "string", indexed: false },
      ],
    },
  ] as const;
  ```

### Hooks

- [ ] **`hooks/useNickname(address)`** — lectura, cacheable

  ```ts
  // hooks/useNickname.ts
  export function useNickname(address?: string) {
    return useReadContract({
      address: PLAYER_REGISTRY_ADDRESS,
      abi: PLAYER_REGISTRY_ABI,
      functionName: "getNickname",
      args: [address as `0x${string}`],
      query: { enabled: !!address && isAddressValid(address) },
    });
  }
  ```

- [ ] **`hooks/useSetNickname()`** — escritura con validación

  ```ts
  // hooks/useSetNickname.ts
  export function useSetNickname() {
    const { mutateAsync } = useWriteContract();
    const publicClient = usePublicClient();

    async function setNickname(name: string) {
      const trimmed = name.trim();
      if (!trimmed || trimmed.length > 20) throw new Error("Nickname inválido");
      const hash = await mutateAsync({
        address: PLAYER_REGISTRY_ADDRESS,
        abi: PLAYER_REGISTRY_ABI,
        functionName: "setNickname",
        args: [trimmed],
      });
      await publicClient!.waitForTransactionReceipt({ hash });
      return trimmed;
    }

    return { setNickname };
  }
  ```

### Display name unificado

- [ ] **Actualizar `hooks/useDisplayName(address)`** — prioridad Nickname → ENS → truncated

  ```ts
  export function useDisplayName(address?: string): string {
    const { data: nickname } = useNickname(address);
    const { data: ens } = useEnsName({
      address: address as `0x${string}`,
      chainId: 1,
    });
    if (nickname) return nickname;
    if (ens) return ens;
    return truncateAddress(address ?? "");
  }
  ```

### UI — Editar nickname

- [ ] **`components/NicknameEditModal.tsx`** — modal con input inline

  ```text
  ┌─────────────────────────────┐
  │  Tu apodo                   │
  │  ┌───────────────────────┐  │
  │  │ CryptoBeast           │  │
  │  └───────────────────────┘  │
  │  máx. 20 caracteres         │
  │  [Cancelar]  [Guardar →]    │
  └─────────────────────────────┘
  ```

  - Input controlado con contador `{name.length}/20`
  - Validación en tiempo real (caracteres no permitidos, longitud)
  - Estado de loading mientras espera receipt
  - Toast de éxito al confirmar

- [ ] **`app/profile/[address]/page.tsx`** — botón editar solo si es tu propio perfil

  ```text
  [  CryptoBeast  ✏️  ]   ← nickname o dirección truncada
  ```

  Si no tiene nickname: _"Sin apodo — toca para agregar"_

### Dónde mostrar el nickname

- [ ] `components/WalletBar.tsx` — nombre en la barra superior
- [ ] `app/game/[roomId]/page.tsx` — HOST / GUEST bajo los dados
- [ ] `app/join/[roomId]/page.tsx` — nombre del host de la sala
- [ ] `app/leaderboard/page.tsx` — cada fila del ranking (reemplaza dirección truncada)
- [ ] `app/profile/[address]/page.tsx` — título principal del perfil + botón editar
- [ ] `app/rooms/page.tsx` — nombre del host en las room cards
- [ ] `app/stats/page.tsx` — actividad reciente

### UI/UX con nicknames

- En leaderboard: nickname en bold + dirección truncada muy sutil debajo
- En room cards de My Rooms: tu nickname en el badge `YOU`
- Nickname con fallback gracioso: `Anonymous#1234` (últimos 4 chars del address) si no tiene apodo
- Animación de celebración en `/game` que muestra el nickname del ganador en grande

---

## 🎨 UI/UX — Mejoras pendientes

### Páginas / flujos

- [ ] **`/rooms` — filtro por token** — pills USDT / USDC / USDm encima de la lista
- [ ] **`/rooms` — empty state mejorado** — ilustración o mensaje más engaging
- [ ] **`/create` — stake input con slider** — mover el monto con slider además del input de texto
- [ ] **`/join` — preview del stake antes de confirmar** — card grande _"Pagas X, puedes ganar ~Y"_
- [ ] **`/game` — confetti más premium en victoria** — partículas con colores del token ganado
- [ ] **Notificación cuando el oponente se une** — PWA push o polling con toast
- [ ] **`/profile` — compartir perfil** — botón share con OG image dinámica del perfil

### Componentes globales

- [ ] **Toast de tx en curso** — spinner en esquina inferior mientras el tx espera receipt
- [ ] **`"Updated 30s ago"` en leaderboard** — indicador de frescura junto a los tabs
- [ ] **Skeletons más fieles** — mismo shape que el contenido real
- [ ] **Bottom navigation bar** — tabs persistentes Home / Rooms / Leaderboard / Profile

### Mobile / MiniPay

- [ ] **Haptic feedback** — `navigator.vibrate(50)` al confirmar reveal y al ganar
- [ ] **Splash screen** — pantalla de carga inicial con logo mientras cargan los datos

---

## ✅ Completado (Mayo 2026)

### 27 Mayo

- ✅ **Nickname registry en `DailyTournament.sol`** — `setNickname` / `getNickname` / `NicknameSet` integrados al contrato existente (sin deploy adicional)
- ✅ **Tests nickname** — 7 casos en `DailyTournament.t.sol`; 40/40 pasando incluyendo fuzz
- ✅ **`TOURNAMENT_ABI`** — ABI completo (nickname + tournament) en `lib/constants.ts`
- ✅ **`lib/ens.ts`** — Resolución Celoname (.celo) → ENS Ideas API (.eth), caché sessionStorage
- ✅ **`hooks/useNickname`** — `useReadContract` sobre `DailyTournament.getNickname`
- ✅ **`hooks/useSetNickname`** — write + `waitForTransactionReceipt`
- ✅ **`hooks/useDisplayName`** — prioridad: Nickname → Celoname/ENS → truncatedAddress
- ✅ **`NicknameEditModal`** — input con contador `/20`, validación, loading, toast éxito
- ✅ **Nickname en `/profile`** — nombre en negrita, botón ✏️ solo en perfil propio, dirección queda subtle debajo
- ✅ **`useDisplayName` wired** — WalletBar, `/game`, `/join`, `/leaderboard`

### 26 Mayo

- ✅ **My Rooms — secciones** — reorganizado en "Your turn" / "Watching" / "Open" con headers de color y dot indicator
- ✅ **My Rooms — Player B recovery** — `getMatchedRoomsAsGuest` + `joinedRooms.ts` + `storeJoinedRoom` en join page; Player B ve sus salas MATCHED aunque no tenga el secret
- ✅ **My Rooms — Copy secret** — botón para copiar el secreto desde My Rooms y usarlo en otro dispositivo
- ✅ **SecretBackupModal** — requiere Copy + checkbox de confirmación antes de poder cerrar; sin auto-dismiss
- ✅ `/game` — **Secret import UI** — cuando el host no tiene el secret en el dispositivo puede pegarlo (0x…64 hex) y revelar
- ✅ `/game` — **Claim expired** — botón para Player B visible siempre que `canClaim = true`; sin gate `SHOW_BLOCK_COUNTDOWN`
- ✅ `/game` — **Countdown legible** — tiempo restante en h/min (no bloques); `REVEAL_WINDOW_BLOCKS` leído directo del contrato con fallback 17 280 bloques (24 h)
- ✅ `/game` — **YOU badge alignment** — columnas de igual altura con `invisible` placeholder; dados alineados
- ✅ `/game` — botón "Paste secret" neutral cuando está disabled (sin color oliva)
- ✅ `/create` — **Balance validation** — `balanceOf` en tiempo real + guard on-chain antes del approve; botón rojo si fondos insuficientes
- ✅ `DiceBattle.sol` — `REVEAL_WINDOW_BLOCKS` cambiado a `17_280` (24 h en Celo Mainnet)

### 25 Mayo

- ✅ `/stats` — TVL on-chain en vivo, balances por token, stats indexer, actividad reciente
- ✅ LiveStats — "Played today" corregido (filtra RESOLVED/TIED) + link a leaderboard hoy
- ✅ Leaderboard — URL param `?period=today` para pre-seleccionar tab
- ✅ My Rooms — fuente dual: localStorage + indexer por `playerA` (multi-device)
- ✅ My Rooms — fix premature empty state durante reconexión de wallet
- ✅ My Rooms — BorderBeam amarillo↔teal en cards _"Ready to reveal"_
- ✅ `/game` — badge LIVE movido al header, condicional por estado, sin solapar dados
- ✅ `/game` — Prize card rediseñada con watermark del token
- ✅ `/game` — fecha de creación de la room + H2H vs oponente
- ✅ `/create` — icono `<Rocket />` en el botón principal
- ✅ Protocol Stats button en home — gradiente vivo amarillo→teal + dot verde live
- ✅ `indexer.ts` — `getActiveRoomsByPlayer`, `getContractStats`, `getRoomsCreatedAt`
- ✅ Favicon — `app/icon.png` + metadata en `layout.tsx`
