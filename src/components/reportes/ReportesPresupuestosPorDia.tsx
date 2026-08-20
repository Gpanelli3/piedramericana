"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, LabelList } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ReportesWidgetShell } from "@/components/reportes/ReportesKpiCard";
import {
  REPORTES_CHART_COLOR,
  type ReportesPresupuestosDia,
} from "@/lib/reportes-api";

const chartConfig = {
  count: { label: "Presupuestos", color: REPORTES_CHART_COLOR },
} satisfies ChartConfig;

type Props = {
  data: ReportesPresupuestosDia[];
};

export function ReportesPresupuestosPorDia({ data }: Props) {
  return (
    <ReportesWidgetShell title="Presupuestos por día (90d)">
      <ChartContainer config={chartConfig} className="aspect-auto h-[180px] w-full">
        <BarChart data={data} margin={{ top: 20, left: 0, right: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
          <YAxis hide />
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Bar dataKey="count" fill="var(--color-count)" radius={[6, 6, 0, 0]} barSize={28}>
            <LabelList dataKey="count" position="top" className="fill-foreground text-xs" />
          </Bar>
        </BarChart>
      </ChartContainer>
    </ReportesWidgetShell>
  );
}
