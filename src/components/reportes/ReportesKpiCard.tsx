import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ReportesKpiCardProps = {
  label: string;
  value: string;
  hint: string;
  className?: string;
};

export function ReportesKpiCard({ label, value, hint, className }: ReportesKpiCardProps) {
  return (
    <Card className={cn("rounded-2xl border-border/70 shadow-sm gap-0 py-0", className)}>
      <CardContent className="space-y-1 px-5 py-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl">
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

type ReportesWidgetShellProps = {
  title: string;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
};

export function ReportesWidgetShell({
  title,
  children,
  className,
  footer,
}: ReportesWidgetShellProps) {
  return (
    <Card className={cn("rounded-2xl border-border/70 shadow-sm gap-0 py-0", className)}>
      <CardHeader className="px-5 pt-4 pb-2">
        <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-4 pt-0">{children}</CardContent>
      {footer ? <div className="border-t border-border/50 px-5 py-2.5 text-xs text-muted-foreground">{footer}</div> : null}
    </Card>
  );
}
