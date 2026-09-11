import type { Snapshot } from "../domain/types";
import { delta, formatMoney, formatPercent, longDate, totals } from "../domain/compute";
import { useDiscreet } from "../state/discreet";
import { useCountUp } from "../state/useMotion";
import { DiscreetValue } from "./DiscreetValue";
import { IconArrowDown, IconArrowUp, IconPlus } from "./icons";
import { Panel } from "./Panel";

interface HeroNetWorthProps {
  snapshot: Snapshot | null;
  previous: Snapshot | null;
  count: number;
  isCurrent: boolean;
  onAdd: () => void;
  onBackToCurrent: () => void;
}

export function HeroNetWorth({ snapshot, previous, count, isCurrent, onAdd, onBackToCurrent }: HeroNetWorthProps) {
  const discreet = useDiscreet();
  const t = snapshot ? totals(snapshot) : { totalAssets: 0, totalLiabilities: 0, netWorth: 0 };
  const prevNw = previous ? totals(previous).netWorth : null;
  const d = delta(t.netWorth, prevNw);
  const animated = useCountUp(t.netWorth);

  if (!snapshot) {
    return (
      <Panel hero className="flex h-full flex-col justify-between p-6 sm:p-8">
        <p className="eyebrow">Net worth</p>
        <div className="py-8">
          <p className="num text-5xl font-medium tracking-tight text-muted sm:text-6xl" style={{ letterSpacing: "-0.03em" }}>
            —
          </p>
          <p className="mt-4 text-sm muted">No snapshots yet. Add the first reading to start the trend.</p>
        </div>
        <button type="button" className="btn btn-primary self-start" onClick={onAdd}>
          <IconPlus /> Add snapshot
        </button>
      </Panel>
    );
  }

  const tone = d.direction === "up" ? "text-up" : d.direction === "down" ? "text-down" : "text-muted";
  const Arrow = d.direction === "down" ? IconArrowDown : IconArrowUp;

  return (
    <Panel hero className="flex h-full flex-col justify-between p-6 sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">Net worth</p>
        {!isCurrent && (
          <button type="button" className="chip hover:bg-ink/5" onClick={onBackToCurrent}>
            Viewing {snapshot.label} · back to current
          </button>
        )}
      </div>

      <div className="py-6 sm:py-8">
        {discreet ? (
          <div className="text-5xl sm:text-7xl" aria-label="Net worth hidden">
            <DiscreetValue value={t.netWorth} max={t.totalAssets} barClassName="discreet-bar-lg" caption />
          </div>
        ) : (
          <p
            className="num text-5xl font-medium leading-none sm:text-7xl"
            style={{ letterSpacing: "-0.035em", fontWeight: 550 }}
            aria-live="polite"
          >
            {formatMoney(animated)}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {prevNw === null ? (
            <span className="muted">First snapshot</span>
          ) : (
            <span className={`inline-flex items-center gap-1.5 font-medium ${tone}`}>
              {d.direction !== "flat" && <Arrow width={14} height={14} />}
              {!discreet && <DiscreetValue value={d.amount} signed className="font-medium" />}
              {d.percent !== null && <span className="num">{discreet ? formatPercent(d.percent) : `(${formatPercent(d.percent)})`}</span>}
              <span className="font-normal text-muted">vs {previous?.label}</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-xs muted">
          as of {longDate(snapshot.dateISO)} · {count} {count === 1 ? "snapshot" : "snapshots"}
        </p>
        <p className="flex items-center gap-4 text-xs muted">
          <span>
            Assets <DiscreetValue value={t.totalAssets} max={t.totalAssets} className="text-ink" />
          </span>
          <span>
            Debt <DiscreetValue value={t.totalLiabilities} max={t.totalAssets} negative className="text-liability-text" />
          </span>
        </p>
      </div>
    </Panel>
  );
}
