import { ChevronDown } from "lucide-react";
import {
  forwardRef,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-md border bg-surface text-fg outline-none focus:border-accent focus:shadow-focus";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-[12.5px] font-medium text-muted", className)} {...props} />;
}

export function Field({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>{children}</div>;
}

export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <span id={id} role="alert" className="text-[12.5px] text-danger">
      {children}
    </span>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        control,
        "h-10 px-3 text-sm",
        invalid ? "border-danger" : "border-line-strong",
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        control,
        "min-h-24 resize-y border-line-strong px-3 py-2.5 text-sm leading-normal",
        className,
      )}
      {...props}
    />
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            control,
            "h-10 cursor-pointer appearance-none border-line-strong pr-[34px] pl-3 text-sm",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          size={14}
          strokeWidth={2}
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
        />
      </div>
    );
  },
);
