import { useCallback, useEffect, useMemo, useState } from "react";
import { readVaultFile, VaultOpenError } from "./crypto/vaultCrypto";
import type { Snapshot, VaultFile } from "./domain/types";
import { accountRows, currentSnapshot, longDate, previousSnapshot } from "./domain/compute";
import { DiscreetContext } from "./state/discreet";
import { useTheme } from "./state/useTheme";
import { useVaultSession } from "./state/useVaultSession";
import { CompositionPanel } from "./components/CompositionPanel";
import { GateScreen } from "./components/GateScreen";
import { HeroNetWorth } from "./components/HeroNetWorth";
import { HistoryGrid } from "./components/HistoryGrid";
import { PassphraseModal } from "./components/PassphraseModal";
import { SnapshotEditor } from "./components/SnapshotEditor";
import { TopBar } from "./components/TopBar";
import { TrendCharts } from "./components/TrendCharts";
import { IconMonitor, IconMoon, IconSun } from "./components/icons";

type Modal =
  | { kind: "open-file"; file: VaultFile; fileName: string }
  | { kind: "create" }
  | { kind: "set"; then: "download" | "lock" | "change" }
  | null;

type Editor = { snapshotId: string | null } | null;

const NO_SNAPSHOTS: Snapshot[] = [];

export default function App() {
  const session = useVaultSession();
  const theme = useTheme();
  const [modal, setModal] = useState<Modal>(null);
  const [editor, setEditor] = useState<Editor>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [unlockDismissed, setUnlockDismissed] = useState(false);

  // Reset per-lock UI state whenever the lock state changes (sanctioned adjust-during-render pattern).
  const [seenLocked, setSeenLocked] = useState(session.locked);
  if (seenLocked !== session.locked) {
    setSeenLocked(session.locked);
    setUnlockDismissed(false);
    setEditor(null);
    setModal(null);
  }

  const themeControl = (
    <button
      type="button"
      className="btn btn-quiet btn-icon"
      onClick={theme.cycle}
      aria-label={`Theme: ${theme.pref}. Switch to ${theme.pref === "system" ? "light" : theme.pref === "light" ? "dark" : "system"}`}
      title={`Theme: ${theme.pref}`}
    >
      {theme.pref === "system" ? <IconMonitor /> : theme.pref === "light" ? <IconSun /> : <IconMoon />}
    </button>
  );

  const lockNotice =
    session.locked && !session.locked.blob
      ? session.locked.reason === "idle"
        ? "Locked after 10 minutes without input. Reopen your vault file to continue."
        : "Vault closed. Reopen your vault file to continue."
      : null;
  const unlockOpen = session.status === "locked" && Boolean(session.locked?.blob) && !unlockDismissed && modal === null;

  const handleDownload = useCallback(async () => {
    const result = await session.download();
    if (result === "needs-passphrase") setModal({ kind: "set", then: "download" });
  }, [session]);

  const handleLock = useCallback(() => {
    if (!session.hasPassphrase) {
      setModal({ kind: "set", then: "lock" });
      return;
    }
    void session.lock("manual");
  }, [session]);

  // ⌘S / Ctrl+S downloads the encrypted vault.
  useEffect(() => {
    if (session.status !== "open") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void handleDownload();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session.status, handleDownload]);

  async function pickFile(file: File) {
    setNotice(null);
    session.clearError();
    try {
      const parsed = await readVaultFile(file);
      setModal({ kind: "open-file", file: parsed, fileName: file.name });
    } catch (e) {
      setNotice(e instanceof VaultOpenError ? e.message : "Could not read that file.");
    }
  }

  function closeModal() {
    session.clearError();
    setModal(null);
  }

  const vault = session.vault;
  const snapshots = vault?.snapshots ?? NO_SNAPSHOTS;
  const current = useMemo(() => (vault ? currentSnapshot(vault) : null), [vault]);
  const selected = useMemo(
    () => (selectedId ? (snapshots.find((s) => s.id === selectedId) ?? current) : current),
    [selectedId, snapshots, current],
  );
  const previous = useMemo(() => (vault ? previousSnapshot(vault, selected) : null), [vault, selected]);
  const accounts = useMemo(() => (vault ? accountRows(vault) : []), [vault]);

  const editingSnapshot: Snapshot | null =
    editor?.snapshotId ? (snapshots.find((s) => s.id === editor.snapshotId) ?? null) : null;

  function saveSnapshot(s: Snapshot) {
    if (editingSnapshot) session.updateSnapshot(s);
    else session.addSnapshot(s);
    setSelectedId(null);
    setEditor(null);
  }

  function deleteSnapshot(id: string) {
    session.deleteSnapshot(id);
    setSelectedId(null);
    setEditor(null);
  }

  const modalNode = (() => {
    if (!modal) return null;
    switch (modal.kind) {
      case "open-file":
        return (
          <PassphraseModal
            mode="open"
            title="Open vault"
            description={`Enter the passphrase for ${modal.fileName}.`}
            submitLabel="Open"
            error={session.error}
            onClose={closeModal}
            onSubmit={async ({ passphrase }) => {
              const ok = await session.openFile(modal.file, passphrase);
              if (ok) {
                setSelectedId(null);
                setModal(null);
              }
            }}
          />
        );
      case "create":
        return (
          <PassphraseModal
            mode="create"
            title="Create vault"
            description="Choose a name and a passphrase. The passphrase encrypts the file you download."
            submitLabel="Create"
            initialName="Household"
            onClose={closeModal}
            onSubmit={({ name, passphrase }) => {
              session.create(name, passphrase);
              setSelectedId(null);
              setModal(null);
            }}
          />
        );
      case "set":
        return (
          <PassphraseModal
            mode="set"
            title={modal.then === "change" ? "Change passphrase" : "Set a passphrase"}
            description={
              modal.then === "download"
                ? "This vault has no passphrase yet. Set one to encrypt the download."
                : modal.then === "lock"
                  ? "Set a passphrase so the vault can be locked and unlocked in this tab."
                  : "The next download is encrypted with the new passphrase. The file you opened keeps the old one."
            }
            submitLabel={modal.then === "download" ? "Set and download" : modal.then === "lock" ? "Set and lock" : "Change"}
            onClose={closeModal}
            onSubmit={async ({ passphrase }) => {
              session.setPassphrase(passphrase, { markDirty: modal.then === "change" });
              setModal(null);
              // Let the ref update settle before acting on it.
              await Promise.resolve();
              if (modal.then === "download") await session.download();
              else if (modal.then === "lock") await session.lock("manual");
            }}
          />
        );
    }
  })();

  const unlockNode = unlockOpen ? (
    <PassphraseModal
      mode="open"
      title={`Unlock ${session.locked?.name ?? "vault"}`}
      description={
        session.locked?.reason === "idle"
          ? "Locked after 10 minutes without input. The encrypted copy is still in this tab."
          : "The passphrase was cleared from memory. Enter it to continue."
      }
      submitLabel="Unlock"
      error={session.error}
      onClose={() => {
        session.clearError();
        setUnlockDismissed(true);
      }}
      secondary={{ label: "Forget and start over", onClick: session.forget }}
      onSubmit={async ({ passphrase }) => {
        await session.unlock(passphrase);
      }}
    />
  ) : null;

  if (session.status !== "open" || !vault) {
    return (
      <DiscreetContext value={session.discreet}>
        <GateScreen
          onPickFile={(f) => void pickFile(f)}
          onCreate={() => {
            setNotice(null);
            setModal({ kind: "create" });
          }}
          onDemo={() => {
            setNotice(null);
            setSelectedId(null);
            session.loadDemo();
          }}
          locked={session.locked}
          onUnlock={() => setUnlockDismissed(false)}
          onForget={session.forget}
          notice={notice ?? lockNotice}
          themeControl={themeControl}
        />
        {unlockNode}
        {modalNode}
      </DiscreetContext>
    );
  }

  return (
    <DiscreetContext value={session.discreet}>
      <div className="min-h-dvh">
        <TopBar
          name={vault.name}
          isDemo={session.isDemo}
          asOf={current ? longDate(current.dateISO) : null}
          dirty={session.dirty}
          discreet={session.discreet}
          onToggleDiscreet={session.toggleDiscreet}
          themeControl={themeControl}
          onLock={handleLock}
          onDownload={() => void handleDownload()}
          onAdd={() => setEditor({ snapshotId: null })}
        />

        <main className="mx-auto w-full max-w-[1400px] space-y-4 px-4 pb-24 pt-5 sm:space-y-6 sm:px-8 sm:pt-8 rise">
          <div className="grid grid-cols-12 gap-4 sm:gap-6">
            <div className="col-span-12 lg:col-span-7">
              <HeroNetWorth
                snapshot={selected}
                previous={previous}
                count={snapshots.length}
                isCurrent={!selected || selected.id === current?.id}
                onAdd={() => setEditor({ snapshotId: null })}
                onBackToCurrent={() => setSelectedId(null)}
              />
            </div>
            <div className="col-span-12 lg:col-span-5">
              <CompositionPanel snapshot={selected} onEdit={() => selected && setEditor({ snapshotId: selected.id })} />
            </div>
          </div>

          <TrendCharts vault={vault} />

          <HistoryGrid
            snapshots={snapshots}
            accounts={accounts}
            currentId={current?.id ?? null}
            selectedId={selected?.id ?? null}
            onSelect={(id) => setSelectedId(id === current?.id ? null : id)}
            onEdit={(id) => {
              setSelectedId(id === current?.id ? null : id);
              setEditor({ snapshotId: id });
            }}
          />

          <footer className="flex flex-wrap gap-x-6 gap-y-1 px-1 pt-2 text-xs muted">
            <span>This app does not keep a copy of your vault.</span>
            <span>Download before you close the tab.</span>
            <span>⌘S downloads the encrypted file.</span>
            <button
              type="button"
              className="underline-offset-4 hover:underline"
              onClick={() => setModal({ kind: "set", then: "change" })}
            >
              Change passphrase
            </button>
          </footer>
        </main>

        {editor && (
          <SnapshotEditor
            key={editor.snapshotId ?? "new"}
            snapshot={editingSnapshot}
            template={editingSnapshot ? null : current}
            onSave={saveSnapshot}
            onDelete={deleteSnapshot}
            onClose={() => setEditor(null)}
          />
        )}
        {modalNode}
      </div>
    </DiscreetContext>
  );
}
