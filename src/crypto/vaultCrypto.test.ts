import { describe, expect, it } from "vitest";
import { demoVault } from "../domain/demoVault";
import { KDF_ITERATIONS } from "../domain/types";
import { decryptVault, encryptVault, parseVaultFile, serializeVaultFile, VaultOpenError } from "./vaultCrypto";

describe("vaultCrypto", () => {
  it("round-trips a vault through encrypt → serialize → parse → decrypt", async () => {
    const vault = demoVault();
    const file = await encryptVault(vault, "correct horse battery staple");
    expect(file.format).toBe("nwvault");
    expect(file.iterations).toBe(KDF_ITERATIONS);
    const text = serializeVaultFile(file);
    expect(text).not.toContain("Demo Family");
    expect(text).not.toContain("116800");
    const parsed = parseVaultFile(text);
    const back = await decryptVault(parsed, "correct horse battery staple");
    expect(back).toEqual(vault);
  });

  it("fails closed on a wrong passphrase", async () => {
    const file = await encryptVault(demoVault(), "right");
    await expect(decryptVault(file, "wrong")).rejects.toBeInstanceOf(VaultOpenError);
    await expect(decryptVault(file, "wrong")).rejects.toMatchObject({ kind: "passphrase" });
  });

  it("uses a fresh salt and IV per save", async () => {
    const a = await encryptVault(demoVault(), "pw");
    const b = await encryptVault(demoVault(), "pw");
    expect(a.saltB64).not.toBe(b.saltB64);
    expect(a.ivB64).not.toBe(b.ivB64);
    expect(a.ciphertextB64).not.toBe(b.ciphertextB64);
  });

  it("rejects files that are not vaults", () => {
    expect(() => parseVaultFile("not json")).toThrow(VaultOpenError);
    expect(() => parseVaultFile(JSON.stringify({ hello: "world" }))).toThrow(VaultOpenError);
  });
});

describe("account lines", () => {
  it("normalizes lines and recomputes category rollups from them", async () => {
    const { normalizeVault } = await import("./vaultCrypto");
    const raw = {
      schema: "networth.vault.v1",
      name: "Lines",
      currency: "USD",
      snapshots: [
        {
          id: "s1",
          dateISO: "2026-01-09",
          label: "Jan 2026",
          amounts: { CASH: 1, STOCK: 0, ALT: 0, HSA: 0, RETIRE: 4000, BUSINESS: 0, DEBT: 0 },
          lines: [
            { id: "a", category: "CASH", name: "Checking", amount: 100.25 },
            { id: "b", category: "CASH", name: "Savings", amount: 50 },
            { category: "DEBT", name: "Card", amount: 20.5 },
          ],
        },
      ],
    };
    const vault = normalizeVault(raw);
    expect(vault).not.toBeNull();
    const s = vault?.snapshots[0];
    expect(s?.amounts.CASH).toBe(150.25);
    expect(s?.amounts.DEBT).toBe(20.5);
    expect(s?.amounts.STOCK).toBe(0);
    // RETIRE has no lines, so its direct amount is kept.
    expect(s?.amounts.RETIRE).toBe(4000);
    expect(s?.lines?.length).toBe(3);
    expect(typeof s?.lines?.[2]?.id).toBe("string");
  });

  it("rejects a line with an unknown category", async () => {
    const { normalizeVault } = await import("./vaultCrypto");
    const raw = {
      schema: "networth.vault.v1",
      snapshots: [{ id: "s1", dateISO: "2026-01-09", amounts: {}, lines: [{ category: "CRYPTO", name: "x", amount: 1 }] }],
    };
    expect(normalizeVault(raw)).toBeNull();
  });
});
