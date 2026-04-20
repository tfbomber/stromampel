// ============================================================
// StromAmpel App — Savings Persistence (Claims)
// Stores "claimed" savings locally via AsyncStorage
// ============================================================

import AsyncStorage from "@react-native-async-storage/async-storage";

export interface ClaimRecord {
  id: string;
  device: string;
  kWh: number;
  savingEur: number;
  claimedAt: number; // Unix ms
  month: string;     // "2026-03"
}

const KEY = "sa_claims_v1";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export { currentMonth as getCurrentMonth };

// ISSUE-1 fix: prune records older than 90 days to prevent unbounded storage growth
const CLAIM_TTL_MS = 90 * 24 * 60 * 60 * 1000;

// ── Read all claims from storage ──────────────────────────────
async function readAll(): Promise<ClaimRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const all: ClaimRecord[] = JSON.parse(raw);
    // Prune stale records; write back only if anything was removed
    const cutoff = Date.now() - CLAIM_TTL_MS;
    const fresh = all.filter((c) => c.claimedAt >= cutoff);
    if (fresh.length < all.length) {
      await AsyncStorage.setItem(KEY, JSON.stringify(fresh)).catch(() => {});
      console.log(`[Savings] Pruned ${all.length - fresh.length} old claim(s) (>90 days)`);
    }
    return fresh;
  } catch {
    return [];
  }
}

// ── Append a new claim ────────────────────────────────────────
export async function addClaim(
  device: string,
  kWh: number,
  savingEur: number
): Promise<void> {
  const now   = Date.now();
  const month = currentMonth();
  const record: ClaimRecord = {
    id: now.toString() + Math.random().toString(36).slice(2, 7),
    device,
    kWh,
    savingEur,
    claimedAt: now,
    month,
  };
  const existing = await readAll();
  await AsyncStorage.setItem(KEY, JSON.stringify([...existing, record]));
}

// ── Query helpers ─────────────────────────────────────────────
export async function getClaimsForMonth(month: string): Promise<ClaimRecord[]> {
  const all = await readAll();
  return all.filter((c) => c.month === month);
}

/** Remove the most recent claim for a given device (undo of a Starten action). */
export async function removeLastClaim(device: string): Promise<void> {
  const all = await readAll();
  // Find the last entry matching this device
  let lastIdx = -1;
  for (let i = all.length - 1; i >= 0; i--) {
    if (all[i].device === device) { lastIdx = i; break; }
  }
  if (lastIdx === -1) return;
  const updated = all.filter((_, i) => i !== lastIdx);
  await AsyncStorage.setItem(KEY, JSON.stringify(updated));
}

/** Unix ms of the most recent Monday 00:00:00 (German/ISO week start) */
export function getStartOfWeek(): number {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon…
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export async function getClaimsForThisWeek(): Promise<ClaimRecord[]> {
  const all   = await readAll();
  const start = getStartOfWeek();
  return all.filter((c) => c.claimedAt >= start);
}
