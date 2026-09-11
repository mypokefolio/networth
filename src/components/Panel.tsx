import type { HTMLAttributes, ReactNode } from "react";

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  hero?: boolean;
  children: ReactNode;
}

export function Panel({ hero = false, className = "", children, ...rest }: PanelProps) {
  return (
    <div className={`panel ${hero ? "panel-hero" : ""} ${className}`} {...rest}>
      {children}
    </div>
  );
}
