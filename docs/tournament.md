# Weekly Tournament

Sistema de torneo semanal con premiación on-chain sobre Celo Mainnet. El contrato `DailyTournament` es independiente de `DiceBattle` — los resultados se leen del indexer Envio y se registran on-chain por el cron del owner.

---

## Contrato desplegado

| Campo | Valor |
|-------|-------|
| Dirección | `0x9F74B63a23CCdc314840f5aA0Bd8c8Ac9Dd78257` |
| Chain | Celo Mainnet (chainId 42220) |
| Token de premio | USDT |
| Owner / deployer | `0xd56279982a6363aD04d8DF8965F4702554AD0553` |
| Bloque de despliegue | ver `git log` |

---

## Reparto de premios

| Puesto | BPS | % | Ejemplo (50 USDT pool) |
|--------|-----|---|------------------------|
| 🥇 1ro | 6 000 | 60% | 30 USDT |
| 🥈 2do | 2 500 | 25% | 12.5 USDT |
| 🥉 3ro | 1 500 | 15% | 7.5 USDT |

- Si hay menos de 3 ganadores, los shares de ranks vacíos se devuelven al owner **en el mismo `setTopWinners`** (sin esperar 30 días).
- Si hay 0 ganadores con ≥5 juegos, el cron no finaliza ese sábado y el pool queda acumulado.

---

## Variables de entorno

```env
# Dirección del contrato (pública — bundled en el cliente)
NEXT_PUBLIC_TOURNAMENT_ADDRESS=0x9F74B63a23CCdc314840f5aA0Bd8c8Ac9Dd78257

# Endpoint GraphQL del indexer Envio (pública)
NEXT_PUBLIC_INDEXER_URL=https://indexer.dev.hyperindex.xyz/04bd01f/v1/graphql

# Hasura admin secret — solo server-side, nunca NEXT_PUBLIC_
INDEXER_ADMIN_SECRET=testing

# Secret para autenticar el cron de Vercel — solo server-side
# Generar con: openssl rand -base64 24
CRON_SECRET=

# Clave privada del owner del contrato — solo server-side
# Usada por el cron para firmar setTopWinners on-chain
TOURNAMENT_OWNER_PRIVATE_KEY=
```

> `CRON_SECRET` y `TOURNAMENT_OWNER_PRIVATE_KEY` deben estar en las **Variables de entorno de Vercel** (nunca commitear al repo).

---

## Flujo completo semana a semana

### Paso 1 — Fondear el pool (manual, hecho por el owner)

Antes del sábado objetivo hay que depositar USDT en el contrato. Son dos transacciones:

**1a. Aprobar al contrato para gastar USDT**

```ts
await walletClient.writeContract({
  address: USDT_ADDRESS,
  abi: ERC20_ABI,
  functionName: "approve",
  args: [TOURNAMENT_ADDRESS, parseUnits("50", 6)], // 50 USDT (6 decimales)
});
```

**1b. Llamar `fundDay`**

```ts
// Calcular el dayId del próximo sábado
const nowSeconds = Math.floor(Date.now() / 1000);
const todayDayId = Math.floor(nowSeconds / 86400);
const dayOfWeek  = new Date().getUTCDay(); // 0=dom, 6=sáb
const daysUntilSat = (6 - dayOfWeek + 7) % 7 || 7;
const saturdayDayId = todayDayId + daysUntilSat;

await walletClient.writeContract({
  address: TOURNAMENT_ADDRESS,
  abi: TOURNAMENT_ABI,
  functionName: "fundDay",
  args: [BigInt(saturdayDayId), parseUnits("50", 6)],
});
```

- Se puede llamar varias veces — el pool se acumula.
- Revierte con `AlreadyFinalized` si el día ya fue cerrado.
- Emite `DayFunded(dayId, amount, totalPool)`.

---

### Paso 2 — Los jugadores juegan (automático)

Durante toda la semana (Domingo 00:00 UTC → Sábado 23:59 UTC) los jugadores crean y resuelven partidas en DiceBattle. El indexer Envio indexa cada evento en tiempo real:

```
Room { winner, playerA, playerB, state, stake, resolvedAt }
```

El contrato DiceBattle **no sabe nada del torneo** — son sistemas completamente independientes.

**Criterios para clasificar:**
- Mínimo **5 juegos** jugados en la semana
- Clasificación: **wins descendente** (criterio primario)
- Desempate: **winRate descendente**
- La UI muestra un score combinado (`wins × winRate / 100`) pero el contrato exige `winCounts` no-decreciente, por eso la clasificación on-chain siempre usa wins brutas.

---

### Paso 3 — El cron finaliza el torneo (automático — domingo 00:00 UTC)

Vercel dispara `GET /api/cron/finalize-tournament`.

#### Autenticación
Vercel inyecta `Authorization: Bearer <CRON_SECRET>` automáticamente. Si el header no coincide → `401 Unauthorized`.

#### Lógica paso a paso

```
domingo 00:00 UTC
  │
  ├─ [Auth] Verifica CRON_SECRET
  ├─ [Config] Verifica TOURNAMENT_ADDRESS y TOURNAMENT_OWNER_PRIVATE_KEY
  │
  ├─ [Tiempo] Calcula:
  │     nowSeconds  = Date.now() / 1000
  │     todayDayId  = floor(nowSeconds / 86400)   ← domingo
  │     saturdayId  = todayDayId - 1              ← sábado recién terminado
  │     weekStart   = (saturdayId - 6) * 86400    ← domingo anterior 00:00 UTC
  │
  ├─ [Idempotencia] Lee dayInfo(saturdayId) del contrato
  │     Si finalized = true → devuelve { skipped: true } sin hacer nada
  │
  ├─ [Indexer] Consulta todos los juegos desde weekStart
  │     Paginado en lotes de 1000 hasta traer todos
  │     Agrega por jugador: wins, losses, ties, winRate
  │
  ├─ [Clasificación]
  │     Filtra: totalGames >= 5
  │     Ordena: wins desc → winRate desc (tiebreak)
  │     Top 3 (rellena con 0x000... si hay menos de 3)
  │     Valida direcciones con isAddress + getAddress (checksum)
  │
  ├─ [On-chain] walletClient.writeContract → setTopWinners(saturdayId, top3, winCounts)
  │     El contrato valida winCounts no-decreciente
  │     Ranks vacíos → tokens devueltos al owner en la misma tx
  │     Emite WinnersSet(dayId, top, wins, pool)
  │
  └─ [Espera] waitForTransactionReceipt (timeout 50 s)
       Devuelve { success: true, saturdayId, top, winCounts, hash }
```

#### Si el cron falla
- El endpoint devuelve un error HTTP — Vercel reintentará automáticamente.
- El check de idempotencia evita doble-finalización si se reintenta después de éxito.
- Si `setTopWinners` revierte (ej. `InvalidWinners`): corregir lógica y redesplegar.

#### Configuración en `vercel.json`
```json
{
  "crons": [{ "path": "/api/cron/finalize-tournament", "schedule": "0 0 * * 0" }]
}
```
`0 0 * * 0` = domingo 00:00 UTC.

#### Probar el cron localmente
```bash
curl -X GET http://localhost:3000/api/cron/finalize-tournament \
  -H "Authorization: Bearer <CRON_SECRET>"
```

---

### Paso 4 — Los ganadores reclaman (manual — desde /tournament)

Después de la finalización, cada ganador ve su premio en `/tournament` y llama `claim`.

```solidity
claim(uint256 dayId, uint8 rank)
// rank: 0 = 1ro, 1 = 2do, 2 = 3ro
```

- **Cualquiera puede llamar en nombre del ganador** — los tokens siempre van a la dirección del ganador.
- Doble claim bloqueado por bitmask (`uint8 claimed`).
- Sin límite de tiempo para reclamar (salvo los 30 días del sweep).
- Emite `Claimed(dayId, rank, winner, amount)`.

#### Lo que ve el ganador en la UI
1. La página `/tournament` muestra "Last week's winners" cuando `finalized = true`.
2. Cada ganador ve su premio en verde y un botón "Claim".
3. Al reclamar, el USDT llega directamente a su wallet.

---

### Paso 5 — Sweep de no reclamados (manual — owner, tras 30 días)

Si un ganador real nunca reclama, el owner puede recuperar esos tokens 30 días después de la finalización:

```solidity
sweepUnclaimed(uint256 dayId)  // onlyOwner
```

- Solo barre ranks que no hayan sido reclamados.
- Revierte con `SweepTooEarly` si no han pasado 30 días.
- Revierte con `NothingToSweep` si todo ya fue reclamado.
- Emite `UnclaimedSwept(dayId, amount)`.

> **Nota:** Los ranks con `address(0)` ya fueron barridos en el Paso 3 — este sweep solo aplica a ganadores reales que no reclamaron.

---

## Checklist para el primer torneo

- [ ] Redesplegar contrato con la nueva lógica de sweep inmediato
- [ ] Actualizar `NEXT_PUBLIC_TOURNAMENT_ADDRESS` en Vercel y `.env.prod`
- [ ] Verificar `CRON_SECRET` en Vercel
- [ ] Verificar `TOURNAMENT_OWNER_PRIVATE_KEY` en Vercel
- [ ] Aprobar USDT al contrato desde la wallet del owner
- [ ] Llamar `fundDay(saturdayDayId, amount)` para fondear el pool
- [ ] Verificar que el indexer esté indexando partidas correctamente
- [ ] El domingo siguiente el cron corre automáticamente

---

## Archivos clave

| Archivo | Descripción |
|---------|-------------|
| [packages/contracts/src/DailyTournament.sol](../packages/contracts/src/DailyTournament.sol) | Contrato on-chain |
| [packages/contracts/test/DailyTournament.t.sol](../packages/contracts/test/DailyTournament.t.sol) | Tests (40 tests, forge) |
| [apps/web/app/api/cron/finalize-tournament/route.ts](../apps/web/app/api/cron/finalize-tournament/route.ts) | Cron de finalización |
| [apps/web/app/tournament/page.tsx](../apps/web/app/tournament/page.tsx) | UI del torneo |
| [apps/web/lib/indexer.ts](../apps/web/lib/indexer.ts) | Cliente GraphQL del indexer (con paginación) |
| [apps/web/vercel.json](../apps/web/vercel.json) | Schedule del cron en Vercel |
