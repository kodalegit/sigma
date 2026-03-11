import * as React from "react";

import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "flex min-h-24 w-full rounded-2xl border border-[#d9e1ea] bg-white px-4 py-3 text-sm text-[#1f2937] shadow-sm outline-none transition placeholder:text-[#94a3b8] focus:border-[#1f8fff] focus:ring-4 focus:ring-[#1f8fff]/10 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
