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
  type ReportesTopMaterial,
} from "@/lib/reportes-api";

const chartConfig = {
  m2: { label: "m²", color: REPORTES_CHART_COLOR },
} satisfies ChartConfig;

type Props = {
  data: ReportesTopMaterial[];
};

export function ReportesTopMateriales({ data }: Props) {
  const rows =
    data.length > 0
      ? data.map((d) => ({
          ...d,
          short: d.nombre.length > 22 ? `${d.nombre.slice(0, 20)}…` : d.nombre,
          labelFmt: `${d.m2} m²`,
        }))
      : [{ nombre: "—", short: "Sin datos", m2: 0, labelFmt: "0 m²" }];

  const max = Math.max(1, ...rows.map((r) => r.m2));

  return (
    <ReportesWidgetShell title="Top materiales (m²)">
      <ChartContainer config={chartConfig} className="aspect-auto h-[200px] w-full">
        <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 48, top: 4, bottom: 4 }}>
          <XAxis type="number" hide domain={[0, max * 1.2]} />
          <YAxis
            type="category"
            dataKey="short"
            width={110}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                labelKey="nombre"
                formatter={(v) => [`${v} m²`, "Consumo"]}
              />
            }
          />
          <Bar dataKey="m2" fill="var(--color-m2)" radius={[0, 6, 6, 0]} barSize={14}>
            <LabelList dataKey="labelFmt" position="right" className="fill-foreground text-[11px]" />
          </Bar>
        </BarChart>
      </ChartContainer>
    </ReportesWidgetShell>
  );
}
