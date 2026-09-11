import { useRef, useState } from "react";
import type { DragEvent, ReactNode } from "react";
import type { LockedInfo } from "../state/useVaultSession";
import { IconFile, IconLock, IconPlus, IconSparkle, Mark } from "./icons";

interface GateScreenProps {
  onPickFile: (file: File) => void;
  onCreate: () => void;
  onDemo: () => void;
  locked: LockedInfo | null;
  onUnlock: () => void;
  onForget: () => void;
  notice: string | null;
  themeControl: ReactNode;
}

export function GateScreen({ onPickFile, onCreate, onDemo, locked, onUnlock, onForget, notice, themeControl }: GateScreenProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drop, setDrop] = useState(false);

  function onDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    setDrop(false);
    const file = e.dataTransfer.files[0];
    if (file) onPickFile(file);
  }

  return (
    <main className="flex min-h-dvh flex-col" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <Mark />
          <span className="text-sm font-medium tracking-tight">Net Worth Vault</span>
        </div>
        {themeControl}
      </header>

      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-5 py-10 sm:px-8 rise">
        <p className="eyebrow">Private net worth</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-medium tracking-tight sm:text-6xl" style={{ letterSpacing: "-0.03em" }}>
          Your numbers live in a file. This app keeps nothing.
        </h1>
        <p className="mt-4 max-w-xl text-base muted">
          Open an encrypted vault, read it in memory, add a snapshot, download it again. No account, no server, no copy left
          behind.
        </p>

        {notice && (
          <p className="mt-6 inline-flex w-fit items-center gap-2 rounded-full border hairline px-3 py-1.5 text-sm" role="status">
            {notice}
          </p>
        )}

        {locked?.blob ? (
          <div className="card mt-10 max-w-md" style={{ minHeight: 0 }}>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border hairline text-muted">
                <IconLock />
              </span>
              <div>
                <p className="font-medium">{locked.name} is locked</p>
                <p className="text-sm muted">
                  {locked.reason === "idle" ? "Locked after 10 minutes without input." : "Locked. The passphrase was cleared."}
                  {locked.dirty ? " Unsaved snapshots are held in memory until you unlock and download." : ""}
                </p>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-2">
              <button type="button" className="btn btn-primary" onClick={onUnlock}>
                Unlock
              </button>
              <button type="button" className="btn btn-quiet" onClick={onForget}>
                Forget and start over
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <button
              type="button"
              className={`card ${drop ? "is-drop" : ""}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDrop(true);
              }}
              onDragLeave={() => setDrop(false)}
              onDrop={onDrop}
            >
              <span className="text-muted">
                <IconFile width={20} height={20} />
              </span>
              <span className="mt-auto pt-8 text-lg font-medium tracking-tight">Open vault file</span>
              <span className="mt-1 text-sm muted">Decrypts in this tab with your passphrase.</span>
              <span className="mt-4 text-xs muted">.nwvault or .json · drag a file here</span>
            </button>
            <button type="button" className="card" onClick={onCreate}>
              <span className="text-muted">
                <IconPlus width={20} height={20} />
              </span>
              <span className="mt-auto pt-8 text-lg font-medium tracking-tight">Create vault</span>
              <span className="mt-1 text-sm muted">Name it, set a passphrase, add your first snapshot.</span>
              <span className="mt-4 text-xs muted">AES-256-GCM · PBKDF2 310,000 rounds</span>
            </button>
            <button type="button" className="card" onClick={onDemo}>
              <span className="text-muted">
                <IconSparkle width={20} height={20} />
              </span>
              <span className="mt-auto pt-8 text-lg font-medium tracking-tight">Load demo</span>
              <span className="mt-1 text-sm muted">Fictional household, nine monthly snapshots.</span>
              <span className="mt-4 text-xs muted">Set a passphrase before downloading</span>
            </button>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".nwvault,.json,application/json"
          className="sr-only"
          aria-label="Open vault file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onPickFile(file);
            e.target.value = "";
          }}
        />
      </section>

      <footer className="flex flex-wrap gap-x-6 gap-y-1 px-5 py-5 text-xs muted sm:px-8">
        <span>No accounts. No servers.</span>
        <span>Download before you close the tab.</span>
        <span>Only your theme preference is stored in this browser.</span>
      </footer>
    </main>
  );
}
