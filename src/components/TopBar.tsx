import type { ReactNode } from "react";
import { IconDownload, IconEye, IconEyeOff, IconLock, IconPlus, Mark } from "./icons";

interface TopBarProps {
  name: string;
  isDemo: boolean;
  asOf: string | null;
  dirty: boolean;
  discreet: boolean;
  onToggleDiscreet: () => void;
  themeControl: ReactNode;
  onLock: () => void;
  onDownload: () => void;
  onAdd: () => void;
}

const DIRTY_COPY = "Unsaved snapshots — download vault.";

export function TopBar({
  name,
  isDemo,
  asOf,
  dirty,
  discreet,
  onToggleDiscreet,
  themeControl,
  onLock,
  onDownload,
  onAdd,
}: TopBarProps) {
  return (
    <header
      className="sticky top-0 z-30 border-b hairline"
      style={{
        background: "color-mix(in srgb, var(--bg) 78%, transparent)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <div className="mx-auto flex w-full max-w-[1400px] items-center gap-2 px-3 py-3 sm:gap-3 sm:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
          <span className="hidden shrink-0 sm:block">
            <Mark size={26} />
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium tracking-tight">{name}</span>
              {isDemo && <span className="chip shrink-0">Demo</span>}
            </div>
            <div className="truncate text-xs muted">{asOf ? `As of ${asOf}` : "No snapshots yet"}</div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {dirty && (
            <span
              className="chip hidden lg:inline-flex"
              style={{ borderColor: "color-mix(in srgb, var(--up) 40%, transparent)" }}
              role="status"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-up" aria-hidden="true" />
              {DIRTY_COPY}
            </span>
          )}
          <button
            type="button"
            className="btn btn-quiet btn-icon"
            onClick={onToggleDiscreet}
            aria-pressed={discreet}
            aria-label={discreet ? "Show amounts" : "Hide amounts"}
            title={discreet ? "Show amounts" : "Hide amounts"}
          >
            {discreet ? <IconEyeOff /> : <IconEye />}
          </button>
          {themeControl}
          <button type="button" className="btn btn-quiet btn-icon" onClick={onLock} aria-label="Lock vault" title="Lock vault">
            <IconLock />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon relative sm:w-auto sm:px-3.5"
            onClick={onDownload}
            aria-label={dirty ? `Download vault. ${DIRTY_COPY}` : "Download vault"}
            title={dirty ? DIRTY_COPY : "Download encrypted vault (⌘S)"}
          >
            <IconDownload />
            <span className="hidden sm:inline">Download</span>
            {dirty && (
              <span
                className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-up ring-2 ring-bg lg:hidden"
                aria-hidden="true"
              />
            )}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-icon sm:w-auto sm:px-3.5"
            onClick={onAdd}
            aria-label="Add snapshot"
            title="Add snapshot"
          >
            <IconPlus />
            <span className="hidden sm:inline">Add snapshot</span>
          </button>
        </div>
      </div>
    </header>
  );
}
