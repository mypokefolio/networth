import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import type { Snapshot, Vault, VaultFile } from "../domain/types";
import { VAULT_SCHEMA } from "../domain/types";
import { sortSnapshots } from "../domain/compute";
import { demoVault } from "../domain/demoVault";
import { decryptVault, encryptVault, serializeVaultFile, VaultOpenError } from "../crypto/vaultCrypto";

export type SessionStatus = "locked" | "open";
export type LockReason = "idle" | "manual";

export interface LockedInfo {
  name: string;
  reason: LockReason;
  /** Ciphertext kept in memory so the same tab can unlock without re-picking the file. */
  blob: VaultFile | null;
  dirty: boolean;
  isDemo: boolean;
}

export interface SessionState {
  status: SessionStatus;
  vault: Vault | null;
  dirty: boolean;
  discreet: boolean;
  error: string | null;
  isDemo: boolean;
  hasPassphrase: boolean;
  locked: LockedInfo | null;
}

export type DownloadResult = "saved" | "needs-passphrase" | "cancelled" | "nothing";

const IDLE_MS = 10 * 60 * 1000;

const BLANK: SessionState = {
  status: "locked",
  vault: null,
  dirty: false,
  discreet: false,
  error: null,
  isDemo: false,
  hasPassphrase: false,
  locked: null,
};

function slug(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "vault";
}

export function vaultFilename(vault: Vault): string {
  return `${slug(vault.name)}-${format(new Date(), "yyyy-MM-dd")}.nwvault`;
}

async function saveTextFile(text: string, filename: string): Promise<"saved" | "cancelled"> {
  const picker = window.showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker.call(window, {
        suggestedName: filename,
        types: [{ description: "Net worth vault", accept: { "application/json": [".nwvault"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return "saved";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      // Any other failure (e.g. sandboxed frame) falls back to a classic download.
    }
  }
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "saved";
}

function errorMessage(e: unknown): string {
  if (e instanceof VaultOpenError) return e.message;
  return "Something went wrong opening this vault.";
}

export function useVaultSession() {
  const [state, setState] = useState<SessionState>(BLANK);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  // The passphrase lives only in this ref. It is never logged or persisted.
  const passRef = useRef<string | null>(null);

  const open = useCallback((vault: Vault, opts: { dirty: boolean; isDemo: boolean; passphrase: string | null }) => {
    passRef.current = opts.passphrase;
    setState((s) => ({
      ...BLANK,
      discreet: s.discreet,
      status: "open",
      vault: { ...vault, snapshots: sortSnapshots(vault.snapshots) },
      dirty: opts.dirty,
      isDemo: opts.isDemo,
      hasPassphrase: opts.passphrase !== null,
    }));
  }, []);

  const create = useCallback(
    (name: string, passphrase: string) => {
      const now = new Date().toISOString();
      const vault: Vault = {
        schema: VAULT_SCHEMA,
        name: name.trim() || "Household",
        currency: "USD",
        createdAt: now,
        updatedAt: now,
        snapshots: [],
      };
      open(vault, { dirty: true, isDemo: false, passphrase });
    },
    [open],
  );

  const openFile = useCallback(
    async (file: VaultFile, passphrase: string): Promise<boolean> => {
      try {
        const vault = await decryptVault(file, passphrase);
        open(vault, { dirty: false, isDemo: false, passphrase });
        return true;
      } catch (e) {
        setState((s) => ({ ...s, error: errorMessage(e) }));
        return false;
      }
    },
    [open],
  );

  const unlock = useCallback(
    async (passphrase: string): Promise<boolean> => {
      const locked = stateRef.current.locked;
      if (!locked?.blob) return false;
      try {
        const vault = await decryptVault(locked.blob, passphrase);
        open(vault, { dirty: locked.dirty, isDemo: locked.isDemo, passphrase });
        return true;
      } catch (e) {
        setState((s) => ({ ...s, error: errorMessage(e) }));
        return false;
      }
    },
    [open],
  );

  const loadDemo = useCallback(() => {
    open(demoVault(), { dirty: false, isDemo: true, passphrase: null });
  }, [open]);

  const setPassphrase = useCallback((passphrase: string, opts: { markDirty?: boolean } = {}) => {
    passRef.current = passphrase;
    setState((s) => ({ ...s, hasPassphrase: true, dirty: s.dirty || Boolean(opts.markDirty) }));
  }, []);

  const mutate = useCallback((fn: (v: Vault) => Vault) => {
    setState((s) => {
      if (!s.vault) return s;
      const next = fn(s.vault);
      return { ...s, vault: { ...next, updatedAt: new Date().toISOString() }, dirty: true };
    });
  }, []);

  const addSnapshot = useCallback(
    (snapshot: Snapshot) => mutate((v) => ({ ...v, snapshots: sortSnapshots([...v.snapshots, snapshot]) })),
    [mutate],
  );

  const updateSnapshot = useCallback(
    (snapshot: Snapshot) =>
      mutate((v) => ({
        ...v,
        snapshots: sortSnapshots(v.snapshots.map((s) => (s.id === snapshot.id ? snapshot : s))),
      })),
    [mutate],
  );

  const deleteSnapshot = useCallback(
    (id: string) => mutate((v) => ({ ...v, snapshots: v.snapshots.filter((s) => s.id !== id) })),
    [mutate],
  );

  const download = useCallback(async (): Promise<DownloadResult> => {
    const s = stateRef.current;
    const pass = passRef.current;
    if (s.status !== "open" || !s.vault) return "nothing";
    if (!pass) return "needs-passphrase";
    const file = await encryptVault(s.vault, pass);
    const result = await saveTextFile(serializeVaultFile(file), vaultFilename(s.vault));
    if (result === "saved") setState((prev) => ({ ...prev, dirty: false }));
    return result;
  }, []);

  const lock = useCallback(async (reason: LockReason) => {
    const s = stateRef.current;
    const pass = passRef.current;
    if (s.status !== "open" || !s.vault) return;
    let blob: VaultFile | null = null;
    if (pass) {
      try {
        blob = await encryptVault(s.vault, pass);
      } catch {
        blob = null;
      }
    }
    passRef.current = null;
    setState((prev) => ({
      ...BLANK,
      discreet: prev.discreet,
      locked: { name: s.vault?.name ?? "Vault", reason, blob, dirty: s.dirty, isDemo: s.isDemo },
    }));
  }, []);

  const forget = useCallback(() => {
    passRef.current = null;
    setState((prev) => ({ ...BLANK, discreet: prev.discreet }));
  }, []);

  const toggleDiscreet = useCallback(() => setState((s) => ({ ...s, discreet: !s.discreet })), []);
  const clearError = useCallback(() => setState((s) => (s.error ? { ...s, error: null } : s)), []);

  // Idle lock after 10 minutes without input.
  useEffect(() => {
    if (state.status !== "open") return;
    let timer = window.setTimeout(() => void lock("idle"), IDLE_MS);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void lock("idle"), IDLE_MS);
    };
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "wheel", "touchstart"];
    for (const ev of events) window.addEventListener(ev, reset, { passive: true });
    return () => {
      window.clearTimeout(timer);
      for (const ev of events) window.removeEventListener(ev, reset);
    };
  }, [state.status, lock]);

  // Warn before leaving with unsaved snapshots.
  useEffect(() => {
    if (!state.dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [state.dirty]);

  return {
    ...state,
    create,
    openFile,
    unlock,
    loadDemo,
    setPassphrase,
    addSnapshot,
    updateSnapshot,
    deleteSnapshot,
    download,
    lock,
    forget,
    toggleDiscreet,
    clearError,
  };
}

export type VaultSession = ReturnType<typeof useVaultSession>;
