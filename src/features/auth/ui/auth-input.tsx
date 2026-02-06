"use client";

import { ForwardedRef, forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/shared/lib/utils";

type Props = React.ComponentProps<typeof Input> & {
  icon?: React.ReactNode;
};

export const AuthInput = forwardRef(function AuthInput(
  { icon, className, ...props }: Props,
  ref: ForwardedRef<HTMLInputElement>,
) {
  return (
    <div className="relative">
      {icon ? (
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35">
          {icon}
        </div>
      ) : null}

      <Input
        ref={ref}
        className={cn(
          "h-12 rounded-xl border-white/10 bg-black/20 text-white placeholder:text-white/25",
          icon ? "pl-10" : "",
          "focus-visible:ring-yellow-400/30 focus-visible:ring-offset-0",
          className,
        )}
        {...props}
      />
    </div>
  );
});
