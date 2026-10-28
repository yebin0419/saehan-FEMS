import { cn } from "@/lib/utils";
import React from "react";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("bg-white border border-slate-200 rounded-lg shadow-sm", className)}>
      {children}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("p-4", className)}>{children}</div>;
}

export function CardTitle({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-semibold text-slate-800">{children}</h3>
      {extra ? <div className="text-xs text-slate-500">{extra}</div> : null}
    </div>
  );
}
