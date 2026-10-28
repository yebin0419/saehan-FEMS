"use client";
import { cn } from "@/lib/utils";
import React from "react";

type Variant = "primary" | "secondary" | "ghost";

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base =
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed";
  const styles: Record<Variant, string> = {
    primary: "bg-brand text-white hover:bg-brand-dark",
    secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
  };
  return (
    <button className={cn(base, styles[variant], className)} {...props}>
      {children}
    </button>
  );
}
