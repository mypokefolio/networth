export const CATEGORY_IDS = ["CASH", "STOCK", "ALT", "HSA", "RETIRE", "BUSINESS", "DEBT"] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export const ASSET_IDS = ["CASH", "STOCK", "ALT", "HSA", "RETIRE", "BUSINESS"] as const satisfies readonly CategoryId[];
export type AssetId = (typeof ASSET_IDS)[number];

export const LIABILITY_IDS = ["DEBT"] as const satisfies readonly CategoryId[];

export type CategoryKind = "asset" | "liability";

export interface CategoryMeta {
  id: CategoryId;
  name: string;
  hint: string;
  kind: CategoryKind;
}

export const CATEGORIES: readonly CategoryMeta[] = [
  { id: "CASH", name: "Cash", hint: "Cash and cash-like", kind: "asset" },
  { id: "STOCK", name: "Stock", hint: "Taxable brokerage, public equities", kind: "asset" },
  { id: "ALT", name: "Alt", hint: "Home equity, private, other non-public", kind: "asset" },
  { id: "HSA", name: "HSA", hint: "Health savings", kind: "asset" },
  { id: "RETIRE", name: "Retire", hint: "Retirement accounts", kind: "asset" },
  { id: "BUSINESS", name: "Business", hint: "Business equity and inventory", kind: "asset" },
  { id: "DEBT", name: "Debt", hint: "Debt is the amount owed", kind: "liability" },
];

/** One account or holding inside a category, e.g. "Chase Bank - Personal" under CASH. */
export interface SnapshotLine {
  id: string;
  category: CategoryId;
  name: string;
  /** For DEBT lines this is the amount owed (positive). */
  amount: number;
}

export interface Snapshot {
  id: string;
  dateISO: string;
  label: string;
  note?: string;
  /**
   * Category rollups. A category that has account lines is the sum of those
   * lines; a category without lines is entered directly.
   */
  amounts: Record<CategoryId, number>;
  /** Optional per-account detail. Absent for rollup-only vaults such as the demo. */
  lines?: SnapshotLine[];
}

export const VAULT_SCHEMA = "networth.vault.v1";

export interface Vault {
  schema: typeof VAULT_SCHEMA;
  name: string;
  currency: "USD";
  createdAt: string;
  updatedAt: string;
  snapshots: Snapshot[];
}

export const VAULT_FILE_FORMAT = "nwvault";
export const VAULT_FILE_VERSION = 1;
export const KDF_ITERATIONS = 310000;

export interface VaultFile {
  format: typeof VAULT_FILE_FORMAT;
  version: typeof VAULT_FILE_VERSION;
  kdf: "PBKDF2-SHA256";
  iterations: typeof KDF_ITERATIONS;
  saltB64: string;
  ivB64: string;
  algo: "AES-256-GCM";
  ciphertextB64: string;
}
