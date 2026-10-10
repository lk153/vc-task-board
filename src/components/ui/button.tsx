import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const variants = {
  primary: "border-0 bg-accent font-medium text-accent-fg hover:bg-accent-hover",
  secondary: "border border-line-strong bg-surface font-medium text-fg hover:bg-surface-2",
  ghost: "border-0 bg-transparent text-muted hover:bg-surface-2 hover:text-fg",
  danger: "border-0 bg-danger font-medium text-white hover:bg-danger-hover",
  dangerGhost: "border-0 bg-transparent font-medium text-danger hover:bg-danger-soft",
} as const;

const sizes = {
  sm: "h-[30px] gap-1.5 px-2.5 text-[13px]",
  md: "h-[34px] gap-1.5 px-3.5 text-[13.5px]",
  lg: "h-[38px] gap-1.5 px-4 text-[13.5px]",
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "lg", className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md whitespace-nowrap transition-colors outline-none focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: "outline" | "ghost";
  size?: number;
}

/** Square icon-only button; `label` becomes the accessible name and tooltip. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = "ghost", size = 34, className, style, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      style={{ width: size, height: size, ...style }}
      className={cn(
        "grid shrink-0 place-items-center rounded-md transition-colors outline-none focus-visible:shadow-focus",
        variant === "outline"
          ? "border border-line-strong bg-surface text-fg hover:bg-surface-2"
          : "border-0 bg-transparent text-muted hover:bg-surface-3 hover:text-fg",
        className,
      )}
      {...props}
    />
  );
});
