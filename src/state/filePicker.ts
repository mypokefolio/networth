/**
 * Choosing the `accept` filter for the vault file input.
 *
 * iOS maps every entry in a file input's `accept` list to a Uniform Type
 * Identifier. `.nwvault` is a custom extension with no registered UTI, so the
 * Files picker renders those files greyed out and they cannot be selected at
 * all. `application/json` does not rescue them either, because iOS types a file
 * by its extension: a `.nwvault` file is `public.data`, not `public.json`.
 * Several Android pickers narrow the same way.
 *
 * The filter is only a convenience. `parseVaultFile` already validates the
 * contents and rejects anything else with a clear message, so when there is any
 * doubt about the platform we send no filter and let validation do the work.
 */

export interface PickerEnv {
  userAgent: string;
  maxTouchPoints: number;
  /** `(pointer: fine)` matches: a mouse, trackpad, or stylus is the primary input. */
  finePointer: boolean;
}

/** Desktop file dialogs honour these correctly. */
export const VAULT_ACCEPT = ".nwvault,.json,application/json";

export function readPickerEnv(): PickerEnv {
  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    finePointer: window.matchMedia?.("(pointer: fine)").matches ?? false,
  };
}

export function isIOS(env: PickerEnv): boolean {
  if (/iPhone|iPad|iPod/.test(env.userAgent)) return true;
  // iPadOS 13+ reports a desktop Safari user agent; touch points give it away.
  return /Macintosh/.test(env.userAgent) && env.maxTouchPoints > 1;
}

/**
 * The filter is sent only for a device that is confidently a desktop: a fine
 * pointer, no touch screen, and not iOS. Anything else gets no filter, so a
 * vault file can never be greyed out and unselectable.
 */
export function vaultAccept(env: PickerEnv): string | undefined {
  if (isIOS(env)) return undefined;
  if (!env.finePointer) return undefined;
  if (env.maxTouchPoints > 0) return undefined;
  return VAULT_ACCEPT;
}

/** Touch devices cannot drag a file onto the page, so the hint has to differ. */
export function canDropFiles(env: PickerEnv): boolean {
  return vaultAccept(env) !== undefined;
}
