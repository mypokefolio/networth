import { formatMoney, formatSigned } from "../domain/compute";
import { useDiscreet } from "../state/discreet";

interface DiscreetValueProps {
  value: number;
  /** Reference amount for the bar width in discreet mode. */
  max?: number;
  /** Show an explicit +/− sign. */
  signed?: boolean;
  /** Render the amount as negative (used for debt). */
  negative?: boolean;
  className?: string;
  barClassName?: string;
  /** Show the visible "Hidden" caption next to the bar. */
  caption?: boolean;
}

export function DiscreetValue({
  value,
  max,
  signed = false,
  negative = false,
  className = "",
  barClassName = "",
  caption = false,
}: DiscreetValueProps) {
  const discreet = useDiscreet();
  const shown = negative ? -Math.abs(value) : value;

  if (!discreet) {
    return <span className={`num ${className}`}>{signed ? formatSigned(shown) : formatMoney(shown)}</span>;
  }

  const ratio = max && max > 0 ? Math.min(1, Math.abs(value) / max) : 0.5;
  const width = `${Math.round((0.16 + ratio * 0.84) * 100)}%`;
  return (
    <span className={`discreet ${className}`} title="Hidden">
      <span className={`discreet-bar ${barClassName}`} aria-hidden="true">
        <span style={{ width }} />
      </span>
      {caption ? <span className="discreet-label">Hidden</span> : <span className="sr-only">Hidden</span>}
    </span>
  );
}
