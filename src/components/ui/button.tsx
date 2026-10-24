import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "default" | "small";
};

const variants = {
  primary: "bg-brand text-white hover:bg-brand-dark focus-visible:ring-brand",
  secondary: "border border-line bg-white text-ink hover:bg-canvas focus-visible:ring-brand",
  ghost: "text-muted hover:bg-mint hover:text-brand focus-visible:ring-brand",
  danger: "bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500"
};

export function Button({
  className,
  variant = "primary",
  size = "default",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        size === "small" ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
