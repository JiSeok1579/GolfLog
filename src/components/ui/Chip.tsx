import type { HTMLAttributes } from "react";
import clsx from "clsx";

type ChipProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "default" | "accent" | "fairway";
};

export function Chip({ className, tone = "default", ...props }: ChipProps) {
  return <span className={clsx("chip", `chip-${tone}`, className)} {...props} />;
}
