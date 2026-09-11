# Net Worth Vault

A private, zero-backend net worth viewer. Your numbers live in an encrypted
`.nwvault` file. The app decrypts it in memory, shows the Net Worth dashboard,
lets you add or edit dated snapshots, and downloads a fresh encrypted file.
Nothing financial is ever written to a server, IndexedDB, localStorage, cookies,
or a service-worker cache.

## Run it

Node 20+ is required (this machine has Node 24 installed at `~/.local/node`,
which is not on the default `PATH`).

```bash
export PATH="$HOME/.local/node/bin:$PATH"
npm install
npm run dev
```

Other scripts:

```bash
npm run build     # type-check (tsc -b) + production bundle in dist/
npm run preview   # serve dist/
npm run lint      # oxlint
npx vitest run    # crypto round-trip tests
```

The app is a static bundle. Serve `dist/` from any static host; no server code exists.

## How the vault file works

A vault is a JSON document:

```ts
interface Vault {
  schema: "networth.vault.v1";
  name: string;            // e.g. "Household"
  currency: "USD";
  createdAt: string;
  updatedAt: string;
  snapshots: Snapshot[];   // sorted by dateISO ascending
}

interface Snapshot {
  id: string;              // uuid
  dateISO: string;         // "2026-07-31" — the actual date of the reading
  label: string;           // "Jul 2026" — display label, auto from date, editable
  note?: string;
  amounts: Record<"CASH" | "STOCK" | "ALT" | "HSA" | "RETIRE" | "BUSINESS" | "DEBT", number>;
}
```

A snapshot may also carry per-account detail. When `lines` is present, the
category `amounts` are the sums of the lines (the app recomputes them on open
and on save):

```ts
interface SnapshotLine {
  id: string;
  category: CategoryId;    // one of the seven fixed categories
  name: string;            // e.g. "Chase Bank - Personal"
  amount: number;          // for DEBT lines: the amount owed
}
```

Lines are per-category and optional, so one snapshot can mix both styles: a
category with lines is the sum of its lines, and a category without lines keeps
the total you typed. In the editor every category is a single total by default;
expanding one reveals its accounts. Adding the first account to a category seeds
it with that category's current total, so the rollup does not move until you
split it, and removing the last account hands the total back to direct entry.
The composition panel expands categories into accounts, and the history grid has
an Accounts / Categories toggle. Adding a snapshot pre-fills accounts and
balances from the latest reading so you only change what moved.

Derived values, in `src/domain/compute.ts`:

- `totalAssets` = CASH + STOCK + ALT + HSA + RETIRE + BUSINESS
- `totalLiabilities` = DEBT (stored as a positive number meaning amount owed)
- `netWorth` = totalAssets − totalLiabilities

The file on disk (`{name}-{YYYY-MM-DD}.nwvault`) is UTF-8 JSON with a plaintext
envelope and an encrypted payload:

```json
{
  "format": "nwvault",
  "version": 1,
  "kdf": "PBKDF2-SHA256",
  "iterations": 310000,
  "saltB64": "…",
  "ivB64": "…",
  "algo": "AES-256-GCM",
  "ciphertextB64": "…"
}
```

`ciphertextB64` is the Vault JSON encrypted with AES-256-GCM. The key is derived
from your passphrase with PBKDF2-SHA-256 (310,000 iterations, 16-byte random
salt). Every save uses a fresh salt and a fresh 12-byte IV. All crypto goes
through the browser's Web Crypto API; see `src/crypto/vaultCrypto.ts`.

A wrong passphrase fails closed with "That passphrase does not open this vault."
There is no recovery path. If you lose the passphrase, the file is unreadable.

## Command-line vault tool

`scripts/vault-tool.mjs` encrypts or decrypts a vault outside the browser with
the same scheme. The passphrase is read from the environment so it stays out of
shell history.

```bash
export PATH="$HOME/.local/node/bin:$PATH"
NW_PASSPHRASE='your passphrase' node scripts/vault-tool.mjs decrypt household.nwvault vault.json
NW_PASSPHRASE='your passphrase' node scripts/vault-tool.mjs encrypt vault.json household.nwvault
```

The decrypted JSON is plaintext. Delete it when you are done. To change a
passphrase from inside the app, use "Change passphrase" in the dashboard footer
and download again.

## Hosting

The app is a static bundle with no server, so any static host works. The build
uses a relative `base`, so it runs unchanged from a domain root or from a
subpath like `https://<user>.github.io/<repo>/`.

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every
push to `main`. It lints, runs the unit tests, and type-checks before it
deploys, so a broken build never reaches the live site. To enable it once:

```bash
gh repo create networth-vault --source=. --push --private   # or --public
gh api -X POST repos/{owner}/networth-vault/pages -f build_type=workflow
```

Or in the browser: Settings → Pages → Source → GitHub Actions.

Nothing about hosting weakens the security boundary below. The page is static,
your vault file is never uploaded, and decryption happens in your browser.

## Security boundary

- **The file is the source of truth.** The app holds the decrypted vault only in
  React state. Closing the tab discards anything you did not download.
- **The passphrase lives in a React ref** for the session, never logged, never
  persisted.
- **Only one key is written to disk:** `localStorage["nw.theme"]`, the theme
  preference (`system` / `light` / `dark`). No cookies, no IndexedDB, no
  service worker.
- **Idle lock.** After 10 minutes without input the app re-encrypts the current
  vault with your passphrase, drops the plaintext and the passphrase, and keeps
  only the ciphertext in memory so you can unlock without re-picking the file.
  If no passphrase has been set yet (a fresh demo), the session is simply cleared.
- **Unsaved edits** show a chip in the top bar, and the browser warns before
  you close or navigate away.
- **No network calls at runtime.** No bank connectors, no price APIs, no
  analytics. Fonts are bundled locally.

## Using it

- **Gate**: open a `.nwvault` (or `.json`) file, create a new vault, or load the
  fictional "Demo Family" vault. The demo has no passphrase until you set one
  to download or lock.
- **Dashboard**: hero net worth with delta vs the previous snapshot,
  composition of the selected snapshot, net worth trend, assets vs liabilities
  trend, and a history grid (newest on the right). Click a column header to
  inspect that snapshot; click the pencil or double-click to edit it.
- **Discreet mode** (eye icon) replaces every dollar figure, including chart
  tooltips and axes, with proportional bars.
- **Keyboard**: `⌘S` / `Ctrl+S` downloads the encrypted vault. `Esc` closes the
  editor or a sheet. `Enter` submits forms.
- **Theme** cycles system → light → dark.

## Project layout

```
src/
  main.tsx                  entry
  App.tsx                   screen routing, modals, keyboard shortcuts
  crypto/vaultCrypto.ts     PBKDF2 + AES-GCM encrypt/decrypt, file parsing
  crypto/vaultCrypto.test.ts
scripts/vault-tool.mjs      CLI encrypt/decrypt with the same scheme
.github/workflows/
  deploy.yml                lint + test + build, publish to GitHub Pages
  domain/types.ts           CategoryId, Snapshot, Vault, VaultFile
  domain/compute.ts         totals, series, delta, labels, money formatting
  domain/demoVault.ts       fictional "Demo Family" data
  state/useVaultSession.ts  open/create/demo/lock/unlock/download, idle timer, beforeunload
  state/useTheme.ts         nw.theme preference + .dark class + theme-color meta
  state/useMotion.ts        reduced-motion hook, count-up hook
  state/discreet.ts         discreet-mode context
  components/               GateScreen, TopBar, HeroNetWorth, CompositionPanel,
                            TrendCharts, HistoryGrid, SnapshotEditor,
                            PassphraseModal, DiscreetValue, Panel, icons
  styles/tokens.css         design tokens (light/dark), Tailwind theme, components
public/
  manifest.webmanifest, icons/, favicon.svg
```

Stack: Vite 8, React 19, TypeScript (strict), Tailwind CSS v4, Recharts 3,
date-fns 4, Web Crypto API. No service worker is registered on purpose, so the
app never caches vault data; it still installs to the iPhone home screen via
the manifest.
