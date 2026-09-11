import type { CategoryId, Snapshot, Vault } from "./types";
import { VAULT_SCHEMA } from "./types";

// Fictional balances for the "Demo Family" household. Not real figures.
const ROWS: ReadonlyArray<[dateISO: string, label: string, amounts: number[], note?: string]> = [
  ["2025-11-30", "Nov 2025", [18400, 61200, 40000, 6100, 94800, 11500, 31200]],
  ["2025-12-31", "Dec 2025", [17900, 63800, 40000, 6350, 97600, 12100, 30600]],
  ["2026-01-31", "Jan 2026", [21300, 62100, 41000, 6600, 96900, 11800, 29900], "Year-end bonus landed"],
  ["2026-02-27", "Feb 2026", [20100, 66400, 41000, 6850, 101200, 12600, 29300]],
  ["2026-03-31", "Mar 2026", [22600, 64900, 42000, 7100, 99700, 13400, 28700], "Home appraisal updated"],
  ["2026-04-30", "Apr 2026", [21800, 69800, 42000, 7350, 105300, 13100, 27400]],
  ["2026-05-29", "May 2026", [23900, 72500, 43500, 7600, 108900, 14200, 26800]],
  ["2026-06-30", "Jun 2026", [23200, 75100, 43500, 7850, 112400, 14900, 26100]],
  ["2026-07-31", "Jul 2026", [24600, 78300, 45000, 8100, 116800, 15300, 25200]],
];

const ORDER: readonly CategoryId[] = ["CASH", "STOCK", "ALT", "HSA", "RETIRE", "BUSINESS", "DEBT"];

export const DEMO_VAULT_NAME = "Demo Family";

export function demoVault(): Vault {
  const snapshots: Snapshot[] = ROWS.map(([dateISO, label, values, note]) => {
    const amounts = {} as Record<CategoryId, number>;
    ORDER.forEach((id, i) => {
      amounts[id] = values[i] ?? 0;
    });
    const s: Snapshot = { id: `demo-${dateISO}`, dateISO, label, amounts };
    if (note) s.note = note;
    return s;
  });
  return {
    schema: VAULT_SCHEMA,
    name: DEMO_VAULT_NAME,
    currency: "USD",
    createdAt: "2025-11-30T12:00:00.000Z",
    updatedAt: "2026-07-31T12:00:00.000Z",
    snapshots,
  };
}
