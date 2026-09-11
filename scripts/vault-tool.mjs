#!/usr/bin/env node
// Encrypt or decrypt a .nwvault file from the command line, using the same
// PBKDF2-SHA-256 (310,000 rounds) + AES-256-GCM scheme as the app.
//
//   NW_PASSPHRASE='...' node scripts/vault-tool.mjs encrypt vault.json out.nwvault
//   NW_PASSPHRASE='...' node scripts/vault-tool.mjs decrypt in.nwvault vault.json
//
// The passphrase is read from the environment so it never appears in shell history.
import { readFileSync, writeFileSync } from "node:fs";
import { webcrypto as crypto } from "node:crypto";

const ITERATIONS = 310000;
const enc = new TextEncoder();
const dec = new TextDecoder();
const toB64 = (bytes) => Buffer.from(bytes).toString("base64");
const fromB64 = (s) => new Uint8Array(Buffer.from(s, "base64"));

async function deriveKey(passphrase, salt, iterations) {
  const material = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encrypt(vault, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, ITERATIONS);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(vault)));
  return {
    format: "nwvault",
    version: 1,
    kdf: "PBKDF2-SHA256",
    iterations: ITERATIONS,
    saltB64: toB64(salt),
    ivB64: toB64(iv),
    algo: "AES-256-GCM",
    ciphertextB64: toB64(new Uint8Array(ciphertext)),
  };
}

async function decrypt(file, passphrase) {
  if (file.format !== "nwvault" || file.version !== 1) throw new Error("Not a v1 nwvault file.");
  const key = await deriveKey(passphrase, fromB64(file.saltB64), file.iterations);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(file.ivB64) }, key, fromB64(file.ciphertextB64));
  return JSON.parse(dec.decode(plaintext));
}

const [mode, input, output] = process.argv.slice(2);
const passphrase = process.env.NW_PASSPHRASE;
if (!mode || !input || !output || !passphrase) {
  console.error("Usage: NW_PASSPHRASE='...' node scripts/vault-tool.mjs <encrypt|decrypt> <in> <out>");
  process.exit(2);
}
const raw = JSON.parse(readFileSync(input, "utf8"));
try {
  if (mode === "encrypt") {
    if (raw.schema !== "networth.vault.v1") throw new Error("Input is not a networth.vault.v1 document.");
    writeFileSync(output, JSON.stringify(await encrypt(raw, passphrase), null, 2) + "\n");
    console.log(`Encrypted ${raw.snapshots?.length ?? 0} snapshots → ${output}`);
  } else if (mode === "decrypt") {
    const vault = await decrypt(raw, passphrase);
    writeFileSync(output, JSON.stringify(vault, null, 2) + "\n");
    console.log(`Decrypted ${vault.snapshots?.length ?? 0} snapshots → ${output} (plaintext — delete when done)`);
  } else {
    throw new Error(`Unknown mode "${mode}".`);
  }
} catch (e) {
  console.error(e instanceof Error && e.name === "OperationError" ? "That passphrase does not open this vault." : String(e.message ?? e));
  process.exit(1);
}
