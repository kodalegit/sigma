import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-[#d9e1ea] bg-[#f7f9fc] px-2.5 py-1 text-xs font-medium text-[#516074]",
        className,
      )}
      {...props}
    />
  );
}
