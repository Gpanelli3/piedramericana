"use client";

import { Bar, BarChart, XAxis, YAxis, LabelList } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ReportesWidgetShell } from "@/components/reportes/ReportesKpiCard";
import {
  REPORTES_CHART_COLOR,
  type ReportesVelocidadEtapa,
} from "@/lib/reportes-api";

const chartConfig = {
  dias: { label: "Días", color: REPORTES_CHART_COLOR },
} satisfies ChartConfig;

type Props = {
  data: ReportesVelocidadEtapa[];
};

export function ReportesVelocidadEtapas({ data }: Props) {
  const max = Math.max(1, ...data.map((d) => d.diasPromedio));
  const rows = data.map((d) => ({
    ...d,
    dias: d.diasPromedio,
    labelFmt: `${d.diasPromedio}d`,
  }));

  return (
    <ReportesWidgetShell
      title="Velocidad por etapa (días prom.)"
      footer="Días promedio en la etapa actual (sin historial de cambios)."
    >
      <ChartContainer config={chartConfig} className="aspect-auto h-[180px] w-full">
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 36, top: 4, bottom: 4 }}>
          <XAxis type="number" hide domain={[0, max * 1.15]} />
          <YAxis
            type="category"
            dataKey="label"
            width={92}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12 }}
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel formatter={(v) => [`${v} días`, "Promedio"]} />}
          />
          <Bar dataKey="dias" fill="var(--color-dias)" radius={[0, 6, 6, 0]} barSize={16}>
            <LabelList dataKey="labelFmt" position="right" className="fill-foreground text-xs" />
          </Bar>
        </BarChart>
      </ChartContainer>
    </ReportesWidgetShell>
  );
}
