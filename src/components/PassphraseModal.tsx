import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { IconEye, IconEyeOff, IconLock, IconX } from "./icons";

export type PassphraseMode = "open" | "create" | "set";

export interface PassphraseSubmit {
  name: string;
  passphrase: string;
}

interface PassphraseModalProps {
  mode: PassphraseMode;
  title: string;
  description?: string;
  submitLabel: string;
  initialName?: string;
  error?: string | null;
  onSubmit: (value: PassphraseSubmit) => Promise<void> | void;
  onClose?: () => void;
  secondary?: { label: string; onClick: () => void };
}

const MIN_LENGTH = 8;

export function PassphraseModal({
  mode,
  title,
  description,
  submitLabel,
  initialName = "",
  error,
  onSubmit,
  onClose,
  secondary,
}: PassphraseModalProps) {
  const [name, setName] = useState(initialName);
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);
  const ids = { name: useId(), pass: useId(), confirm: useId(), err: useId(), desc: useId() };

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const needsConfirm = mode !== "open";
  const shownError = localError ?? error ?? null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (mode === "create" && !name.trim()) {
      setLocalError("Give the vault a name.");
      return;
    }
    if (needsConfirm && pass.length < MIN_LENGTH) {
      setLocalError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (needsConfirm && pass !== confirm) {
      setLocalError("Passphrases do not match.");
      return;
    }
    if (!pass) {
      setLocalError("Enter the passphrase.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit({ name: name.trim(), passphrase: pass });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 p-0 backdrop-blur-sm sm:items-center sm:p-6 fade"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
            e.preventDefault();
            e.currentTarget.requestSubmit();
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${ids.desc}-title`}
        aria-describedby={description ? ids.desc : undefined}
        className="panel slide-up w-full max-w-md rounded-b-none p-6 sm:rounded-b-[20px] sm:p-7"
        style={{ background: "var(--solid)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border hairline text-muted">
              <IconLock />
            </span>
            <h2 id={`${ids.desc}-title`} className="text-lg font-medium tracking-tight">
              {title}
            </h2>
          </div>
          {onClose && (
            <button type="button" className="btn btn-quiet btn-icon -mr-2 -mt-1" onClick={onClose} aria-label="Close">
              <IconX />
            </button>
          )}
        </div>
        {description && (
          <p id={ids.desc} className="mt-3 text-sm muted">
            {description}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-4">
          {mode === "create" && (
            <div className="field">
              <label htmlFor={ids.name} className="label">
                Vault name
              </label>
              <input
                ref={firstRef}
                id={ids.name}
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Household"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          )}
          <div className="field">
            <label htmlFor={ids.pass} className="label">
              Passphrase
            </label>
            <div className="relative">
              <input
                ref={mode === "create" ? undefined : firstRef}
                id={ids.pass}
                className="input pr-11"
                type={show ? "text" : "password"}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                autoComplete={needsConfirm ? "new-password" : "current-password"}
                aria-invalid={shownError ? true : undefined}
                aria-describedby={shownError ? ids.err : undefined}
              />
              <button
                type="button"
                className="btn btn-quiet btn-icon absolute right-1 top-1/2 -translate-y-1/2"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Hide passphrase" : "Show passphrase"}
                aria-pressed={show}
              >
                {show ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
          </div>
          {needsConfirm && (
            <div className="field">
              <label htmlFor={ids.confirm} className="label">
                Confirm passphrase
              </label>
              <input
                id={ids.confirm}
                className="input"
                type={show ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          )}
        </div>

        <div className="mt-3 min-h-5 text-sm" aria-live="polite">
          {shownError && (
            <p id={ids.err} className="text-down">
              {shownError}
            </p>
          )}
        </div>

        <p className="mt-2 text-xs muted">
          {needsConfirm
            ? "The passphrase never leaves this device and cannot be recovered. On a phone, Face ID or a passkey can wrap this key later."
            : "Decrypted in memory only. Nothing is written to disk."}
        </p>

        <div className="mt-5 flex items-center justify-between gap-3">
          {secondary ? (
            <button type="button" className="btn btn-quiet -ml-3" onClick={secondary.onClick}>
              {secondary.label}
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Deriving key…" : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
