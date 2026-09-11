import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { CATEGORIES, CATEGORY_IDS } from "../domain/types";
import type { CategoryId, Snapshot, SnapshotLine } from "../domain/types";
import { formatMoney, labelFromDate, rollupAmounts, todayISO } from "../domain/compute";
import { IconChevron, IconPlus, IconTrash, IconX } from "./icons";

interface SnapshotEditorProps {
  snapshot: Snapshot | null;
  /** When adding, the snapshot whose accounts and amounts pre-fill the form. */
  template?: Snapshot | null;
  onSave: (snapshot: Snapshot) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

type AmountStrings = Record<CategoryId, string>;

interface LineDraft {
  id: string;
  category: CategoryId;
  name: string;
  amount: string;
}

function parseAmount(s: string): number {
  const cleaned = s.replace(/[$,\s]/g, "").replace(/−/g, "-");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function displayAmount(n: number): string {
  if (n === 0) return "";
  const hasCents = Math.abs(n - Math.trunc(n)) > 0.000001;
  return n.toLocaleString("en-US", { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: 2 });
}

function amountsFrom(source: Snapshot | null): AmountStrings {
  const out = {} as AmountStrings;
  for (const id of CATEGORY_IDS) out[id] = source ? displayAmount(source.amounts[id]) : "";
  return out;
}

function draftsFrom(lines: readonly SnapshotLine[], freshIds: boolean): LineDraft[] {
  return lines.map((l) => ({
    id: freshIds ? crypto.randomUUID() : l.id,
    category: l.category,
    name: l.name,
    amount: displayAmount(l.amount),
  }));
}

export function SnapshotEditor({ snapshot, template = null, onSave, onDelete, onClose }: SnapshotEditorProps) {
  const source = snapshot ?? template;
  const [dateISO, setDateISO] = useState(snapshot?.dateISO ?? todayISO());
  const [label, setLabel] = useState(snapshot?.label ?? labelFromDate(todayISO()));
  const [labelTouched, setLabelTouched] = useState(Boolean(snapshot));
  const [note, setNote] = useState(snapshot?.note ?? "");
  const [amounts, setAmounts] = useState<AmountStrings>(() => amountsFrom(source));
  const [lines, setLines] = useState<LineDraft[]>(() => draftsFrom(source?.lines ?? [], !snapshot));
  const [open, setOpen] = useState<ReadonlySet<CategoryId>>(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const uid = useId();

  useEffect(() => {
    dateRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const live = useMemo(() => {
    const direct = {} as Record<CategoryId, number>;
    for (const id of CATEGORY_IDS) direct[id] = parseAmount(amounts[id]);
    const parsedLines = lines.map((l) => ({ id: l.id, category: l.category, name: l.name, amount: parseAmount(l.amount) }));
    const perCategory = rollupAmounts(direct, parsedLines);
    let assets = 0;
    let debt = 0;
    for (const c of CATEGORIES) {
      if (c.kind === "asset") assets += perCategory[c.id];
      else debt += perCategory[c.id];
    }
    return { perCategory, assets, debt, net: assets - debt };
  }, [amounts, lines]);

  const anyLines = lines.length > 0;
  const allOpen = CATEGORY_IDS.every((id) => open.has(id));

  function toggle(id: CategoryId) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onDateChange(v: string) {
    setDateISO(v);
    if (!labelTouched) setLabel(labelFromDate(v));
  }

  function setAmount(id: CategoryId, v: string) {
    setAmounts((a) => ({ ...a, [id]: v }));
  }
  function blurAmount(id: CategoryId) {
    setAmounts((a) => ({ ...a, [id]: displayAmount(parseAmount(a[id])) }));
  }

  function updateLine(id: string, patch: Partial<Pick<LineDraft, "name" | "amount">>) {
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }
  function blurLine(id: string) {
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, amount: displayAmount(parseAmount(l.amount)) } : l)));
  }

  /** First account in a category inherits the category's direct total so the rollup does not move. */
  function addLine(category: CategoryId) {
    const id = crypto.randomUUID();
    const first = !lines.some((l) => l.category === category);
    const seed = first ? displayAmount(parseAmount(amounts[category])) : "";
    setLines((ls) => [...ls, { id, category, name: "", amount: seed }]);
    setOpen((prev) => new Set(prev).add(category));
    window.setTimeout(() => document.getElementById(`${uid}-line-${id}`)?.focus(), 0);
  }

  /** Removing the last account hands the category total back to direct entry. */
  function removeLine(id: string) {
    const line = lines.find((l) => l.id === id);
    if (!line) return;
    const remaining = lines.filter((l) => l.id !== id);
    if (!remaining.some((l) => l.category === line.category)) {
      setAmounts((a) => ({ ...a, [line.category]: displayAmount(live.perCategory[line.category]) }));
    }
    setLines(remaining);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
      setError("Pick a date for this reading.");
      return;
    }
    const direct = {} as Record<CategoryId, number>;
    for (const id of CATEGORY_IDS) direct[id] = parseAmount(amounts[id]);
    const kept: SnapshotLine[] = [];
    for (const l of lines) {
      const amount = parseAmount(l.amount);
      const name = l.name.trim();
      if (!name && amount === 0) continue;
      if (!name) {
        setError(`Name the ${l.category} account with ${formatMoney(amount)}.`);
        return;
      }
      kept.push({ id: l.id, category: l.category, name, amount });
    }
    const rolled = rollupAmounts(direct, kept);
    for (const c of CATEGORIES) {
      const lineDriven = kept.some((l) => l.category === c.id);
      if (!lineDriven && rolled[c.id] < 0) {
        setError(`${c.id} cannot be negative. Debt is entered as the amount owed.`);
        return;
      }
    }
    const next: Snapshot = {
      id: snapshot?.id ?? crypto.randomUUID(),
      dateISO,
      label: label.trim() || labelFromDate(dateISO),
      amounts: rolled,
    };
    if (kept.length > 0) next.lines = kept;
    if (note.trim()) next.note = note.trim();
    onSave(next);
  }

  const groups = [
    { title: "Assets", cats: CATEGORIES.filter((c) => c.kind === "asset") },
    { title: "Liability", cats: CATEGORIES.filter((c) => c.kind === "liability") },
  ];

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-end bg-ink/25 backdrop-blur-[2px] fade"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={submit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
            e.preventDefault();
            e.currentTarget.requestSubmit();
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        className="slide-up flex max-h-[92dvh] w-full flex-col rounded-t-[24px] border-t hairline sm:h-dvh sm:max-h-none sm:w-[520px] sm:rounded-none sm:rounded-l-[24px] sm:border-l sm:border-t-0"
        style={{ background: "var(--solid)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-between px-5 pt-5 sm:px-7 sm:pt-7">
          <div>
            <p className="eyebrow">{snapshot ? "Edit snapshot" : "Add snapshot"}</p>
            <h2 id={`${uid}-title`} className="mt-1.5 text-xl font-medium tracking-tight">
              {label || "New reading"}
            </h2>
          </div>
          <button type="button" className="btn btn-quiet btn-icon" onClick={onClose} aria-label="Close editor (Esc)">
            <IconX />
          </button>
        </div>

        <div className="scrollbar-thin mt-5 flex-1 overflow-y-auto px-5 sm:px-7">
          <div className="grid grid-cols-2 gap-3">
            <div className="field">
              <label htmlFor={`${uid}-date`} className="label">
                Date of reading
              </label>
              <input
                ref={dateRef}
                id={`${uid}-date`}
                type="date"
                className="input"
                value={dateISO}
                onChange={(e) => onDateChange(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor={`${uid}-label`} className="label">
                Label
              </label>
              <input
                id={`${uid}-label`}
                className="input"
                value={label}
                onChange={(e) => {
                  setLabel(e.target.value);
                  setLabelTouched(true);
                }}
                placeholder={labelFromDate(dateISO) || "Sep 2026"}
              />
            </div>
          </div>
          <div className="field mt-3">
            <label htmlFor={`${uid}-note`} className="label">
              Note <span className="font-normal">(optional)</span>
            </label>
            <input
              id={`${uid}-note`}
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Bonus landed, appraisal updated…"
            />
          </div>

          <div className="mt-6 flex items-center justify-between">
            <p className="text-xs muted">
              {!snapshot && template
                ? `Pre-filled from ${template.label}. Change what moved.`
                : "Enter category totals, or expand a category to track its accounts."}
            </p>
            <button
              type="button"
              className="shrink-0 text-xs muted underline-offset-4 hover:underline"
              onClick={() => setOpen(allOpen ? new Set() : new Set(CATEGORY_IDS))}
            >
              {allOpen ? "Collapse all" : "Expand all"}
            </button>
          </div>

          {groups.map((g) => (
            <fieldset key={g.title} className="mt-5">
              <legend className="eyebrow">{g.title}</legend>
              <div className="mt-2 flex flex-col">
                {g.cats.map((c) => {
                  const liability = c.kind === "liability";
                  const catLines = lines.filter((l) => l.category === c.id);
                  const derived = catLines.length > 0;
                  const isOpen = open.has(c.id);
                  const total = live.perCategory[c.id];
                  const panelId = `${uid}-panel-${c.id}`;
                  return (
                    <div key={c.id} className="border-t hairline py-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="btn btn-quiet btn-icon h-8 w-8 shrink-0"
                          onClick={() => toggle(c.id)}
                          aria-expanded={isOpen}
                          aria-controls={panelId}
                          aria-label={`${isOpen ? "Hide" : "Show"} ${c.id} accounts`}
                        >
                          <IconChevron
                            width={14}
                            height={14}
                            className={`transition-transform ${isOpen ? "rotate-90" : ""}`}
                            style={{ transitionDuration: "180ms" }}
                          />
                        </button>
                        <label htmlFor={`${uid}-${c.id}`} className="flex min-w-0 flex-1 flex-col">
                          <span className={`cat ${liability ? "text-liability-text" : "text-ink"}`}>{c.id}</span>
                          <span className="truncate text-[11px] muted">
                            {derived ? `Sum of ${catLines.length} ${catLines.length === 1 ? "account" : "accounts"}` : c.hint}
                          </span>
                        </label>
                        <input
                          id={`${uid}-${c.id}`}
                          className={`input input-num w-36 shrink-0 ${derived ? "muted" : ""}`}
                          inputMode="decimal"
                          autoComplete="off"
                          value={derived ? displayAmount(total) || "0" : amounts[c.id]}
                          onChange={(e) => setAmount(c.id, e.target.value)}
                          onBlur={() => blurAmount(c.id)}
                          placeholder="0"
                          readOnly={derived}
                          aria-readonly={derived}
                          title={derived ? "Edit the accounts below to change this total" : undefined}
                          style={derived ? { background: "transparent", borderStyle: "dashed" } : undefined}
                        />
                      </div>

                      {isOpen && (
                        <div id={panelId} className="mt-2 flex flex-col gap-1.5 pl-10 rise">
                          {catLines.map((l) => (
                            <div key={l.id} className="grid grid-cols-[1fr_7.5rem_2rem] items-center gap-2">
                              <input
                                id={`${uid}-line-${l.id}`}
                                className="input h-9 text-[13px]"
                                value={l.name}
                                onChange={(e) => updateLine(l.id, { name: e.target.value })}
                                placeholder="Account name"
                                aria-label={`${c.id} account name`}
                                autoComplete="off"
                                spellCheck={false}
                              />
                              <input
                                className="input input-num h-9 text-[13px]"
                                inputMode="decimal"
                                autoComplete="off"
                                value={l.amount}
                                onChange={(e) => updateLine(l.id, { amount: e.target.value })}
                                onBlur={() => blurLine(l.id)}
                                placeholder="0"
                                aria-label={`${l.name || c.id} balance`}
                              />
                              <button
                                type="button"
                                className="btn btn-quiet btn-icon h-8 w-8"
                                onClick={() => removeLine(l.id)}
                                aria-label={`Remove ${l.name || "account"}`}
                                title="Remove account"
                              >
                                <IconX width={14} height={14} />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            className="btn btn-quiet -ml-2 h-8 self-start text-xs"
                            onClick={() => addLine(c.id)}
                          >
                            <IconPlus width={13} height={13} /> Add account
                          </button>
                          {!derived && (
                            <p className="-mt-1 text-[11px] muted">
                              The first account starts at the {c.id} total, so nothing changes until you split it.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <dl className="mt-5 rounded-2xl border hairline p-4 text-sm">
            <div className="flex justify-between py-1">
              <dt className="muted">Total assets</dt>
              <dd className="num">{formatMoney(live.assets)}</dd>
            </div>
            <div className="flex justify-between py-1 text-liability-text">
              <dt>Debt</dt>
              <dd className="num">{formatMoney(-live.debt)}</dd>
            </div>
            <div className="mt-1 flex justify-between border-t hairline pt-2 font-medium">
              <dt>Net worth</dt>
              <dd className="num text-base">{formatMoney(live.net)}</dd>
            </div>
          </dl>

          <div className="min-h-6 pt-3 text-sm text-down" aria-live="polite">
            {error}
          </div>
          {anyLines && <p className="sr-only">Categories with accounts total automatically.</p>}
        </div>

        <div className="flex items-center justify-between gap-3 border-t hairline px-5 py-4 sm:px-7">
          {snapshot ? (
            confirmDelete ? (
              <span className="flex items-center gap-2">
                <button type="button" className="btn btn-danger" onClick={() => onDelete(snapshot.id)}>
                  Delete {snapshot.label}
                </button>
                <button type="button" className="btn btn-quiet" onClick={() => setConfirmDelete(false)}>
                  Keep
                </button>
              </span>
            ) : (
              <button type="button" className="btn btn-quiet -ml-3 text-down" onClick={() => setConfirmDelete(true)}>
                <IconTrash /> Delete
              </button>
            )
          ) : (
            <span className="text-xs muted">Saved to memory. Download to keep it.</span>
          )}
          <button type="submit" className="btn btn-primary">
            Save to vault
          </button>
        </div>
      </form>
    </div>
  );
}
