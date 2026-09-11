import { Area, AreaChart, Bar, CartesianGrid, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Vault } from "../domain/types";
import { assetsLiabilitiesSeries, formatCompact, formatMoney, netWorthSeries } from "../domain/compute";
import type { AssetsLiabilitiesPoint, NetWorthPoint } from "../domain/compute";
import { useDiscreet } from "../state/discreet";
import { useReducedMotion } from "../state/useMotion";
import { Panel } from "./Panel";

interface TrendChartsProps {
  vault: Vault;
}

const HEIGHT = 240;

const axisTick = { fill: "var(--muted)", fontSize: 11, fontFamily: "var(--font-mono)" } as const;

function EmptyChart({ children }: { children: string }) {
  return (
    <div
      className="flex items-center justify-center rounded-2xl border border-dashed hairline text-sm muted"
      style={{ height: HEIGHT }}
    >
      {children}
    </div>
  );
}

interface TipEntry {
  dataKey?: string | number;
  value?: unknown;
  payload?: unknown;
}

interface TipProps {
  active?: boolean;
  payload?: ReadonlyArray<TipEntry>;
  label?: unknown;
  kind?: "nw" | "al";
  discreet?: boolean;
}

function ChartTooltip({ active, payload, label, kind = "nw", discreet = false }: TipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const first = payload[0];
  const rows: Array<{ name: string; value: number; tone?: string }> = [];
  if (kind === "nw") {
    const p = first?.payload as NetWorthPoint | undefined;
    if (p) rows.push({ name: "Net worth", value: p.netWorth });
  } else {
    const p = first?.payload as AssetsLiabilitiesPoint | undefined;
    if (p) {
      rows.push({ name: "Assets", value: p.assets });
      rows.push({ name: "Debt", value: -p.liabilities, tone: "text-liability-text" });
      rows.push({ name: "Net worth", value: p.assets - p.liabilities });
    }
  }
  return (
    <div className="rounded-xl border hairline px-3 py-2 text-xs shadow-panel" style={{ background: "var(--solid)" }}>
      <p className="mb-1 font-medium">{String(label ?? "")}</p>
      {rows.map((r) => (
        <p key={r.name} className={`flex justify-between gap-6 ${r.tone ?? ""}`}>
          <span className="muted">{r.name}</span>
          <span className="num">{discreet ? "Hidden" : formatMoney(r.value)}</span>
        </p>
      ))}
    </div>
  );
}

interface DotProps {
  cx?: number;
  cy?: number;
  index?: number;
  lastIndex?: number;
}

function LastDot({ cx, cy, index, lastIndex }: DotProps) {
  if (index !== lastIndex || cx === undefined || cy === undefined) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={9} fill="var(--up)" opacity={0.18} />
      <circle cx={cx} cy={cy} r={4} fill="var(--up)" stroke="var(--bg)" strokeWidth={2} />
    </g>
  );
}

export function TrendCharts({ vault }: TrendChartsProps) {
  const discreet = useDiscreet();
  const reduce = useReducedMotion();
  const nw = netWorthSeries(vault);
  const al = assetsLiabilitiesSeries(vault).map((p) => ({ ...p, liabilitiesNeg: -p.liabilities }));
  const empty = nw.length === 0;
  const yTick = discreet ? false : axisTick;
  const yWidth = discreet ? 12 : 56;

  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
      <Panel className="p-5 sm:p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="eyebrow">Net worth · trend</h2>
          <span className="text-xs muted">{empty ? "" : `${nw.length} readings`}</span>
        </div>
        <div className="mt-4">
          {empty ? (
            <EmptyChart>Add a snapshot to draw the trend.</EmptyChart>
          ) : (
            <ResponsiveContainer width="100%" height={HEIGHT}>
              <AreaChart data={nw} margin={{ top: 12, right: 32, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--asset)" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="var(--asset)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: "var(--line)" }}
                  tick={axisTick}
                  interval="preserveStartEnd"
                  minTickGap={28}
                  dy={6}
                />
                <YAxis
                  width={yWidth}
                  tickLine={false}
                  axisLine={false}
                  tick={yTick}
                  tickFormatter={(v: number) => formatCompact(v)}
                  domain={["auto", "auto"]}
                  tickCount={4}
                />
                <Tooltip
                  content={<ChartTooltip kind="nw" discreet={discreet} />}
                  cursor={{ stroke: "var(--line)", strokeWidth: 1 }}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="netWorth"
                  stroke="var(--asset)"
                  strokeWidth={2}
                  fill="url(#nwFill)"
                  isAnimationActive={!reduce}
                  animationDuration={700}
                  animationEasing="ease-out"
                  dot={<LastDot lastIndex={nw.length - 1} />}
                  activeDot={{ r: 4, fill: "var(--up)", stroke: "var(--bg)", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Panel>

      <Panel className="p-5 sm:p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="eyebrow">Assets and liabilities · trend</h2>
          <span className="flex items-center gap-3 text-xs muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-asset" aria-hidden="true" /> Assets
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-liability" aria-hidden="true" /> Debt
            </span>
          </span>
        </div>
        <div className="mt-4">
          {empty ? (
            <EmptyChart>Assets and debt appear here once you add a snapshot.</EmptyChart>
          ) : (
            <ResponsiveContainer width="100%" height={HEIGHT}>
              <ComposedChart data={al} margin={{ top: 12, right: 32, left: 0, bottom: 0 }} stackOffset="sign" barCategoryGap="32%">
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={axisTick}
                  interval="preserveStartEnd"
                  minTickGap={28}
                  dy={6}
                />
                <YAxis
                  width={yWidth}
                  tickLine={false}
                  axisLine={false}
                  tick={yTick}
                  tickFormatter={(v: number) => formatCompact(Math.abs(v))}
                  tickCount={5}
                />
                <ReferenceLine y={0} stroke="var(--line)" />
                <Tooltip
                  content={<ChartTooltip kind="al" discreet={discreet} />}
                  cursor={{ fill: "color-mix(in srgb, var(--text) 4%, transparent)" }}
                  isAnimationActive={false}
                />
                <Bar dataKey="assets" stackId="a" fill="var(--asset)" radius={[4, 4, 0, 0]} isAnimationActive={!reduce} animationDuration={600} />
                <Bar
                  dataKey="liabilitiesNeg"
                  stackId="a"
                  fill="var(--liability)"
                  radius={[0, 0, 4, 4]}
                  isAnimationActive={!reduce}
                  animationDuration={600}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </Panel>
    </div>
  );
}
