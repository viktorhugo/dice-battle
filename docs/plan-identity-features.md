# Plan — Identity Features

> Estado: propuesta · Fecha: 2026-05-15

## Resumen

Tres features de identidad progresivas para enriquecer el perfil de jugador:

| Feature | Complejidad | Gas | Dependencia externa |
|---|---|---|---|
| 1. ENS display | Baja | 0 | Ethereum mainnet RPC |
| 2. Nickname on-chain | Media | Sí (1 tx) | Ninguna |
| 3. SELF KYC badge | Alta | Sí (1 tx) | SELF Protocol app |

**Orden recomendado:** ENS → Nickname → SELF KYC

---

## Feature 1 — ENS Display

### ¿Qué hace?
Resuelve el nombre ENS de una dirección Ethereum (ej. `vitalik.eth`) y lo muestra en el perfil y en la WalletBar en lugar de la dirección truncada.

### Implementación

**Dependencias:** Ninguna nueva — wagmi ya incluye `useEnsName`.

**Configuración:** Hay que añadir la chain `mainnet` de viem al provider de wagmi (actualmente solo tiene Celo):

```typescript
// apps/web/lib/wagmi.ts  (o donde esté el WagmiProvider)
import { mainnet } from "wagmi/chains"
// añadir mainnet al array de chains
```

**Hook:**
```typescript
import { useEnsName } from "wagmi"
import { mainnet } from "wagmi/chains"

const { data: ensName } = useEnsName({
  address: profileAddress,
  chainId: mainnet.id,
})
// ensName = "vitalik.eth" | null | undefined
```

**Dónde usarlo:**
- `components/WalletBar.tsx` — sustituir dirección truncada por ENS si existe
- `app/profile/[address]/page.tsx` — encabezado del perfil
- `app/join/[roomId]/page.tsx` — nombre del host
- `app/game/[roomId]/page.tsx` — etiquetas Host / Guest

**Notas:**
- Requiere un RPC de Ethereum mainnet (Infura / Alchemy / publicClient). Añadir `NEXT_PUBLIC_ETH_RPC_URL` al `.env`.
- La mayoría de usuarios de MiniPay no tendrán ENS — la UI debe degradarse sin problema (mostrar dirección truncada como ahora).
- Alternativa Celo-nativa: **SpaceID** (`.celo` domains) — API pública en `https://api.prd.space.id`.

---

## Feature 2 — Nickname On-Chain

### ¿Qué hace?
El jugador puede guardar un nombre personalizado (ej. `Jarvis`, `DiceKing`) en un contrato `PlayerProfile.sol`. Se muestra en su perfil con su Identicon.

### Contrato — `PlayerProfile.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract PlayerProfile {
    uint8 public constant MAX_LENGTH = 32;

    mapping(address => string) public nicknames;

    event NicknameSet(address indexed player, string nickname);

    error TooLong();
    error EmptyName();

    function setNickname(string calldata name) external {
        if (bytes(name).length == 0) revert EmptyName();
        if (bytes(name).length > MAX_LENGTH) revert TooLong();
        nicknames[msg.sender] = name;
        emit NicknameSet(msg.sender, name);
    }

    function getNickname(address player) external view returns (string memory) {
        return nicknames[player];
    }
}
```

**Deploy:** mismo Makefile, nuevo target `deploy-profile-sepolia` / `deploy-profile-mainnet`.

**Frontend:**
- `useReadContract` para leer `getNickname(address)` en el perfil
- `useWriteContract` para llamar `setNickname(name)` con un input en el perfil propio
- Env var: `NEXT_PUBLIC_PROFILE_ADDRESS`

**UX en la página de perfil:**
```
[Identicon]  vitalik.eth  ✓         ← si tiene ENS
             DiceKing               ← si tiene nickname  
             0x1804…1f38            ← fallback dirección
```

**Prioridad de visualización:** ENS > Nickname > dirección truncada

---

## Feature 3 — SELF KYC Badge

### ¿Qué hace?
El usuario verifica su identidad con su pasaporte usando la app **SELF** (ZK proof). Una vez verificado, aparece un badge `✓ Verified` en su perfil sin revelar ningún dato personal.

### Cómo funciona SELF Protocol
1. El frontend muestra un QR code con `@selfxyz/react`
2. El usuario abre la app SELF en su móvil y escanea el QR
3. La app lee el chip NFC de su pasaporte y genera una ZK proof
4. La proof se envía al contrato verificador de SELF en Celo
5. El contrato almacena que esa dirección está verificada
6. El frontend lee `isVerified(address)` → muestra el badge

### Contrato SELF en Celo
SELF tiene contratos deployed en Celo mainnet y Sepolia. La integración on-chain requiere heredar de `SelfVerificationRoot` o llamar a su contrato `IdentityVerificationHub`.

> Verificar dirección exacta en: https://docs.self.xyz/integration/smart-contract

### Dependencias
```bash
pnpm add @selfxyz/react @selfxyz/core --filter web
```

**Componente:**
```tsx
import { SelfQRcodeWrapper, SelfAppBuilder } from "@selfxyz/react"

const selfApp = new SelfAppBuilder({
  appName: "Dice Battle",
  scope: "dice-battle-kyc",
  endpoint: `${process.env.NEXT_PUBLIC_URL}/api/self/verify`,
  // campos opcionales — minimizar para privacidad:
  disclosures: { minimumAge: 18 },
}).build()

<SelfQRcodeWrapper
  selfApp={selfApp}
  onSuccess={() => refetchVerificationStatus()}
/>
```

**API Route** (`apps/web/app/api/self/verify/route.ts`):
- Recibe el proof del callback
- Verifica con `SelfBackendVerifier` de `@selfxyz/core`
- Emite una tx al contrato (o simplemente confía en el contrato on-chain)

**Lectura del badge:**
```typescript
// useReadContract con el contrato IdentityVerificationHub de SELF
const { data: isVerified } = useReadContract({
  address: SELF_HUB_ADDRESS,
  abi: SELF_HUB_ABI,
  functionName: "isVerified",
  args: [profileAddress],
})
```

**Badge en UI:**
```tsx
{isVerified && (
  <span title="Identity verified with SELF" className="text-xs text-green-400">
    ✓ Verified
  </span>
)}
```

### Consideraciones
- Solo disponible en móvil (requiere app SELF + NFC en el teléfono)
- El proceso tarda ~30 segundos
- La verificación es permanente on-chain — no necesita repetirse
- No revela nombre, pasaporte ni ningún dato personal
- SELF soporta Celo — confirmar antes de implementar en qué chains tienen deployed el Hub

---

## Archivos a crear / modificar

### Nuevos archivos
```
packages/contracts/src/PlayerProfile.sol
packages/contracts/script/DeployProfile.s.sol
packages/contracts/test/PlayerProfile.t.sol
apps/web/app/api/self/verify/route.ts          (solo para SELF)
```

### Archivos modificados
```
apps/web/lib/wagmi.ts                  (añadir mainnet para ENS)
apps/web/lib/constants.ts              (PROFILE_ADDRESS, SELF_HUB_ADDRESS)
apps/web/app/profile/[address]/page.tsx
apps/web/components/WalletBar.tsx
apps/web/app/join/[roomId]/page.tsx    (mostrar ENS/nickname del host)
apps/web/app/game/[roomId]/page.tsx    (mostrar ENS/nickname en etiquetas)
apps/web/.env.local                    (NEXT_PUBLIC_PROFILE_ADDRESS, etc.)
packages/contracts/Makefile            (nuevos targets)
```

---

## Roadmap sugerido

```
Sprint 1 (1-2 días)
  [ ] ENS display en WalletBar y página de perfil
  [ ] ENS en join/game para el host y opponent
  [ ] Fallback limpio cuando no hay ENS

Sprint 2 (1-2 días)
  [ ] PlayerProfile.sol + tests
  [ ] Deploy Sepolia, luego mainnet
  [ ] UI de edición de nickname en página de perfil propia
  [ ] Prioridad ENS > Nickname en todos los lugares

Sprint 3 (2-3 días)
  [ ] Integrar @selfxyz/react en página de perfil
  [ ] API route de verificación
  [ ] Badge ✓ Verified en perfil
  [ ] Confirmar contratos SELF en Celo con docs oficiales
```

---

## Referencias

- SELF Protocol docs: https://docs.self.xyz
- SELF React SDK: https://github.com/selfxyz/self
- ENS wagmi hook: https://wagmi.sh/react/api/hooks/useEnsName
- SpaceID Celo API: https://docs.space.id/developer-guide/web3-name-sdk
