import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { CATEGORIES } from "../domain/types";
import type { CategoryId, Snapshot } from "../domain/types";
import { longDate, totals } from "../domain/compute";
import type { AccountRow } from "../domain/compute";
import { DiscreetValue } from "./DiscreetValue";
import { IconPencil } from "./icons";
import { Panel } from "./Panel";

interface HistoryGridProps {
  snapshots: Snapshot[];
  accounts: AccountRow[];
  currentId: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
}

type View = "accounts" | "categories";

const assetMeta = CATEGORIES.filter((c) => c.kind === "asset");
const debtMeta = CATEGORIES.find((c) => c.kind === "liability");

export function HistoryGrid({ snapshots, accounts, currentId, selectedId, onSelect, onEdit }: HistoryGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const count = snapshots.length;
  const hasAccounts = accounts.length > 0;
  const [view, setView] = useState<View>("accounts");
  const showAccounts = hasAccounts && view === "accounts";

  // Newest column sits on the right; start there.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [count]);

  const totalsById = new Map(snapshots.map((s) => [s.id, totals(s)] as const));
  const max = Math.max(1, ...snapshots.map((s) => totalsById.get(s.id)?.totalAssets ?? 0));

  const stickyBase = "sticky left-0 z-10 border-r hairline text-left";
  const stickyStyle: CSSProperties = { background: "var(--solid)" };
  const selectedBg = "color-mix(in srgb, var(--text) 4%, transparent)";

  function cellClass(extra = "") {
    return `num whitespace-nowrap px-3 py-2 text-right text-[13px] sm:px-4 ${extra}`.trim();
  }
  function cellStyle(id: string): CSSProperties | undefined {
    return id === selectedId ? { background: selectedBg } : undefined;
  }

  function valueRow(opts: {
    key: string;
    label: ReactNode;
    value: (s: Snapshot) => number | null;
    liability?: boolean;
    bold?: boolean;
    sub?: boolean;
    rowClass?: string;
    rowStyle?: CSSProperties;
    labelStyle?: CSSProperties;
    hint?: string;
  }) {
    const tone = opts.liability ? "text-liability-text" : "";
    return (
      <tr key={opts.key} className={opts.rowClass ?? "border-t hairline"} style={opts.rowStyle}>
        <th
          scope="row"
          className={`${stickyBase} ${opts.sub ? "py-1.5 pl-9 pr-4 sm:pl-10 sm:pr-5" : "px-5 py-2 sm:px-6"}`}
          style={opts.labelStyle ?? stickyStyle}
          title={opts.hint}
        >
          {opts.label}
        </th>
        {snapshots.map((s) => {
          const v = opts.value(s);
          return (
            <td
              key={s.id}
              className={cellClass(`${tone} ${opts.bold ? "font-medium" : ""} ${opts.sub ? "py-1.5 text-[12.5px] muted" : ""}`)}
              style={cellStyle(s.id)}
            >
              {v === null ? <span className="muted">—</span> : <DiscreetValue value={v} max={max} negative={opts.liability} />}
            </td>
          );
        })}
      </tr>
    );
  }

  function categoryBlock(id: CategoryId, label: string, liability: boolean, hint: string) {
    const rows: ReactNode[] = [];
    const lines = showAccounts ? accounts.filter((a) => a.category === id) : [];
    rows.push(
      valueRow({
        key: id,
        label: (
          <span className={`cat ${liability ? "text-liability-text" : ""}`}>
            {label}
            {lines.length > 0 && <span className="ml-1.5 normal-case tracking-normal text-[11px] font-normal muted">{lines.length}</span>}
          </span>
        ),
        value: (s) => s.amounts[id],
        liability,
        bold: lines.length > 0,
        hint,
        rowClass: lines.length > 0 ? "border-t hairline" : "border-t hairline",
      }),
    );
    for (const a of lines) {
      rows.push(
        valueRow({
          key: a.key,
          label: (
            <span className="block max-w-[200px] truncate text-[12.5px] font-normal muted sm:max-w-[260px]" title={a.name}>
              {a.name}
            </span>
          ),
          value: (s) => a.amounts.get(s.id) ?? null,
          liability,
          sub: true,
          rowClass: "",
          hint: a.name,
        }),
      );
    }
    return rows;
  }

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 sm:px-6">
        <h2 className="eyebrow">History</h2>
        <div className="flex items-center gap-3">
          {hasAccounts && (
            <div className="flex rounded-full border hairline p-0.5 text-xs" role="tablist" aria-label="History detail">
              {(["accounts", "categories"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={`rounded-full px-2.5 py-1 capitalize transition-colors ${view === v ? "bg-ink text-bg" : "muted hover:text-ink"}`}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
          <p className="hidden text-xs muted sm:block">Click a column to inspect it · newest on the right</p>
        </div>
      </div>

      {snapshots.length === 0 ? (
        <div className="m-5 flex h-32 items-center justify-center rounded-2xl border border-dashed hairline text-sm muted sm:m-6">
          No snapshots in this vault yet.
        </div>
      ) : (
        <div ref={scrollRef} className="scrollbar-thin mt-3 overflow-x-auto pb-1">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr>
                <th scope="col" className={`${stickyBase} px-5 py-3 sm:px-6`} style={stickyStyle}>
                  <span className="cat">{showAccounts ? "Account" : "Category"}</span>
                </th>
                {snapshots.map((s) => {
                  const selected = s.id === selectedId;
                  const current = s.id === currentId;
                  return (
                    <th key={s.id} scope="col" className="px-2 py-2 align-bottom font-normal" style={cellStyle(s.id)}>
                      <div className="flex flex-col items-end gap-1">
                        {current && (
                          <span className="chip" style={{ borderColor: "color-mix(in srgb, var(--up) 45%, transparent)" }}>
                            Current
                          </span>
                        )}
                        <div className="flex items-center gap-1">
                          {selected && (
                            <button
                              type="button"
                              className="btn btn-quiet btn-icon h-7 w-7"
                              onClick={() => onEdit(s.id)}
                              aria-label={`Edit ${s.label}`}
                              title="Edit snapshot"
                            >
                              <IconPencil width={14} height={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onSelect(s.id)}
                            onDoubleClick={() => onEdit(s.id)}
                            aria-pressed={selected}
                            className={`rounded-lg px-2 py-1 text-right transition-colors hover:bg-ink/5 ${selected ? "text-ink" : "text-muted"}`}
                            title={s.note ? s.note : `Inspect ${s.label}`}
                          >
                            <span className="block text-sm font-medium">{s.label}</span>
                            <span className="num block text-[11px] muted">{longDate(s.dateISO)}</span>
                          </button>
                        </div>
                        <span
                          className="h-0.5 w-full rounded-full transition-colors"
                          style={{ background: selected ? "var(--up)" : "transparent" }}
                          aria-hidden="true"
                        />
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {assetMeta.flatMap((c) => categoryBlock(c.id, c.id, false, c.hint))}
              {valueRow({
                key: "total-assets",
                label: <span className="cat text-ink">Total assets</span>,
                value: (s) => totalsById.get(s.id)?.totalAssets ?? 0,
                bold: true,
                rowClass: "border-t-2 hairline",
              })}
              {debtMeta && categoryBlock(debtMeta.id, "Debt", true, debtMeta.hint)}
              {valueRow({
                key: "net-worth",
                label: <span className="cat text-ink">Net worth</span>,
                value: (s) => totalsById.get(s.id)?.netWorth ?? 0,
                bold: true,
                rowClass: "border-t-2 hairline",
                rowStyle: { background: "color-mix(in srgb, var(--text) 3%, transparent)" },
                labelStyle: { background: "color-mix(in srgb, var(--text) 3%, var(--solid))" },
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
