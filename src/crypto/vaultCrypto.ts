import { CATEGORY_IDS, KDF_ITERATIONS, VAULT_FILE_FORMAT, VAULT_FILE_VERSION, VAULT_SCHEMA } from "../domain/types";
import type { CategoryId, Snapshot, SnapshotLine, Vault, VaultFile } from "../domain/types";
import { rollupAmounts, sortSnapshots } from "../domain/compute";

export type VaultErrorKind = "passphrase" | "format";

export class VaultOpenError extends Error {
  readonly kind: VaultErrorKind;
  constructor(kind: VaultErrorKind, message: string) {
    super(message);
    this.name = "VaultOpenError";
    this.kind = kind;
  }
}

export const PASSPHRASE_ERROR = "That passphrase does not open this vault.";
export const FORMAT_ERROR = "That file is not a vault this app can read.";

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptVault(vault: Vault, passphrase: string): Promise<VaultFile> {
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const key = await deriveKey(passphrase, salt, KDF_ITERATIONS);
  const plaintext = enc.encode(JSON.stringify(vault));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return {
    format: VAULT_FILE_FORMAT,
    version: VAULT_FILE_VERSION,
    kdf: "PBKDF2-SHA256",
    iterations: KDF_ITERATIONS,
    saltB64: toB64(salt),
    ivB64: toB64(iv),
    algo: "AES-256-GCM",
    ciphertextB64: toB64(new Uint8Array(ciphertext)),
  };
}

export async function decryptVault(file: VaultFile, passphrase: string): Promise<Vault> {
  let plaintext: ArrayBuffer;
  try {
    const key = await deriveKey(passphrase, fromB64(file.saltB64), file.iterations);
    plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(file.ivB64) }, key, fromB64(file.ciphertextB64));
  } catch {
    throw new VaultOpenError("passphrase", PASSPHRASE_ERROR);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(dec.decode(plaintext));
  } catch {
    throw new VaultOpenError("format", FORMAT_ERROR);
  }
  const vault = normalizeVault(parsed);
  if (!vault) throw new VaultOpenError("format", FORMAT_ERROR);
  return vault;
}

export function serializeVaultFile(file: VaultFile): string {
  return JSON.stringify(file, null, 2);
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

export function parseVaultFile(text: string): VaultFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new VaultOpenError("format", FORMAT_ERROR);
  }
  if (
    !isRecord(raw) ||
    raw.format !== VAULT_FILE_FORMAT ||
    raw.version !== VAULT_FILE_VERSION ||
    raw.kdf !== "PBKDF2-SHA256" ||
    raw.algo !== "AES-256-GCM" ||
    typeof raw.iterations !== "number" ||
    typeof raw.saltB64 !== "string" ||
    typeof raw.ivB64 !== "string" ||
    typeof raw.ciphertextB64 !== "string"
  ) {
    throw new VaultOpenError("format", FORMAT_ERROR);
  }
  if (raw.iterations !== KDF_ITERATIONS) {
    throw new VaultOpenError("format", FORMAT_ERROR);
  }
  return {
    format: VAULT_FILE_FORMAT,
    version: VAULT_FILE_VERSION,
    kdf: "PBKDF2-SHA256",
    iterations: KDF_ITERATIONS,
    saltB64: raw.saltB64,
    ivB64: raw.ivB64,
    algo: "AES-256-GCM",
    ciphertextB64: raw.ciphertextB64,
  };
}

export async function readVaultFile(file: File): Promise<VaultFile> {
  const text = await file.text();
  return parseVaultFile(text);
}

function isCategoryId(x: unknown): x is CategoryId {
  return typeof x === "string" && (CATEGORY_IDS as readonly string[]).includes(x);
}

function normalizeLine(x: unknown): SnapshotLine | null {
  if (!isRecord(x)) return null;
  if (!isCategoryId(x.category) || typeof x.name !== "string") return null;
  const amount = typeof x.amount === "number" && Number.isFinite(x.amount) ? x.amount : 0;
  const id = typeof x.id === "string" && x.id ? x.id : crypto.randomUUID();
  return { id, category: x.category, name: x.name, amount };
}

function normalizeSnapshot(x: unknown): Snapshot | null {
  if (!isRecord(x)) return null;
  if (typeof x.id !== "string" || typeof x.dateISO !== "string") return null;
  const rawAmounts = isRecord(x.amounts) ? x.amounts : {};
  let amounts = {} as Record<CategoryId, number>;
  for (const id of CATEGORY_IDS) {
    const v = rawAmounts[id];
    amounts[id] = typeof v === "number" && Number.isFinite(v) ? v : 0;
  }
  let lines: SnapshotLine[] | undefined;
  if (Array.isArray(x.lines)) {
    lines = [];
    for (const raw of x.lines) {
      const line = normalizeLine(raw);
      if (!line) return null;
      lines.push(line);
    }
    if (lines.length > 0) amounts = rollupAmounts(amounts, lines);
    else lines = undefined;
  }
  const s: Snapshot = {
    id: x.id,
    dateISO: x.dateISO,
    label: typeof x.label === "string" ? x.label : x.dateISO,
    amounts,
  };
  if (typeof x.note === "string" && x.note.length > 0) s.note = x.note;
  if (lines) s.lines = lines;
  return s;
}

export function normalizeVault(x: unknown): Vault | null {
  if (!isRecord(x) || x.schema !== VAULT_SCHEMA || !Array.isArray(x.snapshots)) return null;
  const snapshots: Snapshot[] = [];
  for (const raw of x.snapshots) {
    const s = normalizeSnapshot(raw);
    if (!s) return null;
    snapshots.push(s);
  }
  const now = new Date().toISOString();
  return {
    schema: VAULT_SCHEMA,
    name: typeof x.name === "string" && x.name.trim() ? x.name : "Household",
    currency: "USD",
    createdAt: typeof x.createdAt === "string" ? x.createdAt : now,
    updatedAt: typeof x.updatedAt === "string" ? x.updatedAt : now,
    snapshots: sortSnapshots(snapshots),
  };
}
