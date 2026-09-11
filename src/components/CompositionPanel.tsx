import { useState } from "react";
import { CATEGORIES, CATEGORY_IDS } from "../domain/types";
import type { CategoryId, Snapshot } from "../domain/types";
import { hasLines, totals } from "../domain/compute";
import { DiscreetValue } from "./DiscreetValue";
import { IconChevron, IconPencil } from "./icons";
import { Panel } from "./Panel";

interface CompositionPanelProps {
  snapshot: Snapshot | null;
  onEdit: () => void;
}

export function CompositionPanel({ snapshot, onEdit }: CompositionPanelProps) {
  const t = snapshot ? totals(snapshot) : { totalAssets: 0, totalLiabilities: 0, netWorth: 0 };
  const max = Math.max(t.totalAssets, 1);
  const detailed = snapshot ? hasLines(snapshot) : false;
  const [open, setOpen] = useState<ReadonlySet<CategoryId>>(() => new Set());
  const allOpen = detailed && CATEGORY_IDS.every((id) => open.has(id));

  function toggle(id: CategoryId) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Panel className="flex h-full flex-col p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="eyebrow">Composition</h2>
        <div className="flex items-center gap-3">
          {detailed && (
            <button
              type="button"
              className="text-xs muted underline-offset-4 hover:underline"
              onClick={() => setOpen(allOpen ? new Set() : new Set(CATEGORY_IDS))}
            >
              {allOpen ? "Hide accounts" : "Show accounts"}
            </button>
          )}
          <span className="text-xs muted">{snapshot ? snapshot.label : "—"}</span>
        </div>
      </div>

      <ul className="mt-4 flex flex-col">
        {CATEGORIES.map((c) => {
          const v = snapshot?.amounts[c.id] ?? 0;
          const liability = c.kind === "liability";
          const lines = detailed ? (snapshot?.lines ?? []).filter((l) => l.category === c.id) : [];
          const expandable = lines.length > 0;
          const isOpen = expandable && open.has(c.id);
          const label = (
            <span className={`cat flex items-center gap-1.5 ${liability ? "text-liability-text" : ""}`}>
              {expandable && (
                <IconChevron
                  width={12}
                  height={12}
                  className={`transition-transform ${isOpen ? "rotate-90" : ""}`}
                  style={{ transitionDuration: "180ms" }}
                />
              )}
              {c.id}
              {expandable && (
                <span className="ml-1 normal-case tracking-normal text-[11px] font-normal muted">
                  {lines.length} {lines.length === 1 ? "account" : "accounts"}
                </span>
              )}
            </span>
          );
          return (
            <li key={c.id} className={`border-t hairline ${liability ? "mt-1 border-t-2" : ""}`} title={c.hint}>
              {expandable ? (
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 py-2.5 text-left"
                  onClick={() => toggle(c.id)}
                  aria-expanded={isOpen}
                >
                  {label}
                  <DiscreetValue
                    value={v}
                    max={max}
                    negative={liability}
                    className={`text-[15px] ${liability ? "text-liability-text" : ""}`}
                  />
                </button>
              ) : (
                <div className="flex items-center justify-between gap-4 py-2.5">
                  {label}
                  <DiscreetValue
                    value={v}
                    max={max}
                    negative={liability}
                    className={`text-[15px] ${liability ? "text-liability-text" : snapshot ? "" : "text-muted"}`}
                  />
                </div>
              )}
              {isOpen && (
                <ul className="mb-2 flex flex-col gap-1 pb-1 pl-5 rise">
                  {lines.map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-4 text-[13px]">
                      <span className="truncate muted" title={l.name}>
                        {l.name}
                      </span>
                      <DiscreetValue
                        value={l.amount}
                        max={max}
                        negative={liability}
                        className={`shrink-0 ${liability ? "text-liability-text" : ""}`}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
        <li className="mt-1 flex items-center justify-between gap-4 border-t-2 hairline pt-3">
          <span className="cat text-ink">Net worth</span>
          <DiscreetValue value={t.netWorth} max={max} className="text-lg font-medium" />
        </li>
      </ul>

      <div className="mt-auto flex items-center justify-between pt-5">
        <p className="text-xs muted">Debt is the amount owed.</p>
        {snapshot && (
          <button type="button" className="btn btn-ghost" onClick={onEdit}>
            <IconPencil /> Edit snapshot
          </button>
        )}
      </div>
    </Panel>
  );
}
