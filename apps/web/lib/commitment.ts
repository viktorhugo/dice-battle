import { encodeAbiParameters, keccak256, type Address, type Hex } from "viem";

/**
 * Generates a cryptographically random 32-byte secret.
 * Uses the Web Crypto API (available in all modern browsers and Node 20+).
 */
export function generateSecret(): Hex {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return ("0x" +
    Array.from(buf)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")) as Hex;
}

/**
 * Computes keccak256(abi.encode(secret, player)).
 * MUST match the `computeCommitment` view in the Solidity contract exactly.
 */
export function computeCommitment(secret: Hex, player: Address): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "address" }],
      [secret, player]
    )
  );
}

/**
 * LocalStorage key for a room's secret.
 * IMPORTANT: the secret is persisted ONLY on the creator's device.
 * If they clear storage before revealing, Player B will claim the pot
 * after the reveal window via `claimExpired`.
 */
const storageKey = (roomId: string | number) => `dice-battle:secret:${roomId}`;

export function storeSecret(roomId: string | number, secret: Hex) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(roomId), secret);
  } catch {
    // ignore (Safari private mode, etc.)
  }
}

export function loadSecret(roomId: string | number): Hex | null {
  if (typeof window === "undefined") return null;
  try {
    return (window.localStorage.getItem(storageKey(roomId)) as Hex) || null;
  } catch {
    return null;
  }
}

export function clearSecret(roomId: string | number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(roomId));
  } catch {
    // ignore
  }
}
