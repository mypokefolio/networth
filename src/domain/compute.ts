import { format, parseISO } from "date-fns";
import { ASSET_IDS, CATEGORY_IDS, LIABILITY_IDS } from "./types";
import type { CategoryId, Snapshot, SnapshotLine, Vault } from "./types";

export interface Totals {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

export function emptyAmounts(): Record<CategoryId, number> {
  const out = {} as Record<CategoryId, number>;
  for (const id of CATEGORY_IDS) out[id] = 0;
  return out;
}

export function totals(snapshot: Snapshot): Totals {
  let totalAssets = 0;
  for (const id of ASSET_IDS) totalAssets += snapshot.amounts[id] ?? 0;
  let totalLiabilities = 0;
  for (const id of LIABILITY_IDS) totalLiabilities += snapshot.amounts[id] ?? 0;
  return { totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities };
}

export function hasLines(snapshot: Snapshot): boolean {
  return Array.isArray(snapshot.lines) && snapshot.lines.length > 0;
}

/**
 * Category rollups for a mixed snapshot: a category with account lines is the
 * sum of those lines; a category without lines keeps its direct amount.
 */
export function rollupAmounts(direct: Record<CategoryId, number>, lines: readonly SnapshotLine[]): Record<CategoryId, number> {
  const sums = emptyAmounts();
  const seen = new Set<CategoryId>();
  for (const line of lines) {
    sums[line.category] += line.amount;
    seen.add(line.category);
  }
  const out = emptyAmounts();
  for (const id of CATEGORY_IDS) {
    const v = seen.has(id) ? sums[id] : (direct[id] ?? 0);
    out[id] = Math.round(v * 100) / 100;
  }
  return out;
}

/** Category rollups when every category is line-driven. */
export function rollupFromLines(lines: readonly SnapshotLine[]): Record<CategoryId, number> {
  return rollupAmounts(emptyAmounts(), lines);
}

/** Returns a snapshot whose `amounts` agree with its `lines` (if any). */
export function withRollups(snapshot: Snapshot): Snapshot {
  if (!hasLines(snapshot)) return snapshot;
  return { ...snapshot, amounts: rollupAmounts(snapshot.amounts, snapshot.lines ?? []) };
}

export function lineKey(category: CategoryId, name: string): string {
  return `${category}::${name.trim().toLowerCase()}`;
}

export interface AccountRow {
  key: string;
  category: CategoryId;
  name: string;
  /** Amount per snapshot id; missing means the account did not exist in that snapshot. */
  amounts: Map<string, number>;
}

/** Union of accounts across all snapshots, ordered by category then first appearance. */
export function accountRows(vault: Vault): AccountRow[] {
  const rows = new Map<string, AccountRow>();
  for (const s of sortSnapshots(vault.snapshots)) {
    for (const line of s.lines ?? []) {
      const key = lineKey(line.category, line.name);
      let row = rows.get(key);
      if (!row) {
        row = { key, category: line.category, name: line.name.trim(), amounts: new Map() };
        rows.set(key, row);
      }
      row.amounts.set(s.id, (row.amounts.get(s.id) ?? 0) + line.amount);
    }
  }
  const order = new Map(CATEGORY_IDS.map((id, i) => [id, i] as const));
  return [...rows.values()].sort((a, b) => (order.get(a.category) ?? 0) - (order.get(b.category) ?? 0));
}

export function sortSnapshots(list: readonly Snapshot[]): Snapshot[] {
  return [...list].sort((a, b) => (a.dateISO < b.dateISO ? -1 : a.dateISO > b.dateISO ? 1 : a.id.localeCompare(b.id)));
}

export function hasActivity(snapshot: Snapshot): boolean {
  return CATEGORY_IDS.some((id) => (snapshot.amounts[id] ?? 0) !== 0);
}

/** Latest snapshot with any non-zero amount; falls back to the latest snapshot. */
export function currentSnapshot(vault: Vault): Snapshot | null {
  const sorted = sortSnapshots(vault.snapshots);
  for (let i = sorted.length - 1; i >= 0; i--) {
    const s = sorted[i];
    if (s && hasActivity(s)) return s;
  }
  return sorted[sorted.length - 1] ?? null;
}

export function previousSnapshot(vault: Vault, of: Snapshot | null): Snapshot | null {
  if (!of) return null;
  const sorted = sortSnapshots(vault.snapshots);
  const idx = sorted.findIndex((s) => s.id === of.id);
  return idx > 0 ? (sorted[idx - 1] ?? null) : null;
}

export interface NetWorthPoint {
  id: string;
  label: string;
  dateISO: string;
  netWorth: number;
}

export function netWorthSeries(vault: Vault): NetWorthPoint[] {
  return sortSnapshots(vault.snapshots).map((s) => ({
    id: s.id,
    label: s.label,
    dateISO: s.dateISO,
    netWorth: totals(s).netWorth,
  }));
}

export interface AssetsLiabilitiesPoint {
  id: string;
  label: string;
  dateISO: string;
  assets: number;
  liabilities: number;
}

export function assetsLiabilitiesSeries(vault: Vault): AssetsLiabilitiesPoint[] {
  return sortSnapshots(vault.snapshots).map((s) => {
    const t = totals(s);
    return { id: s.id, label: s.label, dateISO: s.dateISO, assets: t.totalAssets, liabilities: t.totalLiabilities };
  });
}

export type Direction = "up" | "down" | "flat";

export interface Delta {
  amount: number;
  percent: number | null;
  direction: Direction;
}

export function delta(current: number, previous: number | null): Delta {
  if (previous === null) return { amount: 0, percent: null, direction: "flat" };
  const amount = current - previous;
  const percent = previous === 0 ? null : (amount / Math.abs(previous)) * 100;
  const direction: Direction = amount > 0.5 ? "up" : amount < -0.5 ? "down" : "flat";
  return { amount, percent, direction };
}

export function labelFromDate(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return Number.isNaN(d.getTime()) ? "" : format(d, "MMM yyyy");
}

export function longDate(dateISO: string): string {
  const d = parseISO(dateISO);
  return Number.isNaN(d.getTime()) ? dateISO : format(d, "d MMM yyyy");
}

export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const MINUS = "−";

/** Whole dollars, real minus sign. */
export function formatMoney(n: number): string {
  const r = Math.round(n);
  const s = money.format(Math.abs(r));
  return r < 0 ? `${MINUS}${s}` : s;
}

/** Whole dollars with explicit sign: +$1,200 / −$400 / $0. */
export function formatSigned(n: number): string {
  const r = Math.round(n);
  const s = money.format(Math.abs(r));
  if (r > 0) return `+${s}`;
  if (r < 0) return `${MINUS}${s}`;
  return s;
}

export function formatCompact(n: number): string {
  const s = compact.format(Math.abs(n));
  return n < 0 ? `${MINUS}${s}` : s;
}

export function formatPercent(p: number | null): string {
  if (p === null || !Number.isFinite(p)) return "";
  const s = `${Math.abs(p).toFixed(1)}%`;
  if (p > 0.05) return `+${s}`;
  if (p < -0.05) return `${MINUS}${s}`;
  return s;
}
