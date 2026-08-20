"use client";

import { Cell, Label, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ReportesWidgetShell } from "@/components/reportes/ReportesKpiCard";
import { REPORTES_CHART_COLOR, type ReportesConversion } from "@/lib/reportes-api";

const chartConfig = {
  aprobados: { label: "Aprobados", color: REPORTES_CHART_COLOR },
  resto: { label: "Resto", color: "oklch(0.92 0.01 60)" },
} satisfies ChartConfig;

type Props = {
  data: ReportesConversion;
  periodoLabel: string;
};

export function ReportesConversionDonut({ data, periodoLabel }: Props) {
  const resto = Math.max(0, data.total - data.aprobados);
  const chartData =
    data.total === 0
      ? [{ name: "resto", value: 1, fill: "var(--color-resto)" }]
      : [
          { name: "aprobados", value: data.aprobados, fill: "var(--color-aprobados)" },
          { name: "resto", value: resto || 0.001, fill: "var(--color-resto)" },
        ];

  return (
    <ReportesWidgetShell title={`Conversión de presupuestos (${periodoLabel})`}>
      <div className="flex items-center gap-4">
        <ChartContainer config={chartConfig} className="mx-auto aspect-square h-[140px] w-[140px]">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={42}
              outerRadius={62}
              strokeWidth={0}
              startAngle={90}
              endAngle={-270}
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-2xl font-bold"
                        >
                          {data.total === 0 ? "0%" : `${Math.round(data.pct)}%`}
                        </tspan>
                      </text>
                    );
                  }
                  return null;
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
        <p className="text-sm text-muted-foreground">
          {data.aprobados} de {data.total} aprobados
        </p>
      </div>
    </ReportesWidgetShell>
  );
}
