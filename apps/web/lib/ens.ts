const CACHE_KEY_PREFIX = "ens-resolve:";
const PROFILE_CACHE_KEY_PREFIX = "ens-profile:";
const CELONAMES_GRAPHQL = "https://celo-indexer-reader.namespace.ninja/graphql";

// Profile cache TTL: 5 minutes. Name-only cache: 10 minutes.
const PROFILE_TTL_MS = 5 * 60 * 1000;
const NAME_TTL_MS    = 10 * 60 * 1000;

// ── Cache helpers (with TTL) ─────────────────────────────────────────────────

interface CacheEntry { v: string; t: number }

function readCache(key: string, ttl: number): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.t > ttl) {
      sessionStorage.removeItem(key);
      return null;
    }
    return entry.v;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: string) {
  if (typeof sessionStorage === "undefined") return;
  try {
    const entry: CacheEntry = { v: value, t: Date.now() };
    sessionStorage.setItem(key, JSON.stringify(entry));
  } catch { /* quota */ }
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface CeloProfile {
  /** Short label, e.g. "cappy" */
  label: string;
  /** Full ENS name, e.g. "cappy.celo.eth" */
  fullName: string;
  /** Display name from the "name" text record, e.g. "Cappy" */
  displayName: string;
  /** Avatar URL from the "avatar" text record */
  avatar: string | null;
  /** Header/banner URL from the "header" text record */
  banner: string | null;
}

// ── Celonames GraphQL ────────────────────────────────────────────────────────

async function fetchCeloProfile(address: string): Promise<CeloProfile | null> {
  try {
    const body = JSON.stringify({
      query: `{
        names(where: { owner: "${address.toLowerCase()}" }, limit: 1) {
          items {
            label
            full_name
            records { texts addresses }
          }
        }
      }`,
    });
    const res = await fetch(CELONAMES_GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const item = data?.data?.names?.items?.[0];
    if (!item) return null;

    const texts: { key: string; value: string }[] = item.records?.texts ?? [];
    const get = (key: string) => texts.find((t) => t.key === key)?.value ?? null;

    return {
      label:       item.label,
      fullName:    item.full_name,
      displayName: get("name") ?? item.label,
      avatar:      get("avatar"),
      banner:      get("header"),
    };
  } catch {
    return null;
  }
}

// ── ENS Ideas fallback ───────────────────────────────────────────────────────

async function resolveEns(address: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.ensideas.com/ens/resolve/${address}`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.name ?? null;
  } catch {
    return null;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolve an address to a display name only (lightweight, cached 10 min).
 * Priority: Celoname display name → ENS .eth → null
 */
export async function resolveAddress(address: string): Promise<string | null> {
  if (!address || address.length < 10) return null;

  const cacheKey = CACHE_KEY_PREFIX + address.toLowerCase();
  const hit = readCache(cacheKey, NAME_TTL_MS);
  if (hit !== null) return hit || null;

  const profile = await fetchCeloProfile(address);
  if (profile) {
    writeCache(cacheKey, profile.displayName);
    writeCache(PROFILE_CACHE_KEY_PREFIX + address.toLowerCase(), JSON.stringify(profile));
    return profile.displayName;
  }

  const ens = await resolveEns(address);
  if (ens) {
    writeCache(cacheKey, ens);
    return ens;
  }

  writeCache(cacheKey, "");
  return null;
}

/**
 * Resolve full Celoname profile (name, avatar, banner) for a given address.
 * Cached for 5 minutes — updates to the Celoname profile appear within 5 min.
 * Returns null if the address has no Celoname registered.
 */
export async function resolveCeloProfile(address: string): Promise<CeloProfile | null> {
  if (!address || address.length < 10) return null;

  const cacheKey = PROFILE_CACHE_KEY_PREFIX + address.toLowerCase();
  const hit = readCache(cacheKey, PROFILE_TTL_MS);
  if (hit !== null) {
    if (hit === "") return null;
    try { return JSON.parse(hit) as CeloProfile; } catch { /* ignore */ }
  }

  const profile = await fetchCeloProfile(address);
  writeCache(cacheKey, profile ? JSON.stringify(profile) : "");
  if (profile) {
    writeCache(CACHE_KEY_PREFIX + address.toLowerCase(), profile.displayName);
  }
  return profile;
}
