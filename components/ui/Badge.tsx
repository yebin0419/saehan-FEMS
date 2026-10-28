import { cn } from "@/lib/utils";

type Kind = "run" | "idle" | "stop" | "info" | "warn" | "critical" | "muted";

const map: Record<Kind, string> = {
  run: "bg-green-100 text-green-700",
  idle: "bg-amber-100 text-amber-700",
  stop: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
  warn: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
  muted: "bg-slate-100 text-slate-600",
};

export function Badge({
  kind = "muted",
  children,
  className,
}: {
  kind?: Kind;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider",
        map[kind],
        className
      )}
    >
      {children}
    </span>
  );
}
