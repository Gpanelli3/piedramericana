import type { PlanCortePlancha } from "@/lib/plan-corte";

const PIEZA_COLORS = [
  "#1e4e7a",
  "#8a4b1f",
  "#5b3d6e",
  "#2f6b4f",
  "#8b3a3a",
  "#3d5a80",
];

type Props = {
  plancha: PlanCortePlancha;
  className?: string;
};

export function PlanCorteCroquis({ plancha, className }: Props) {
  const w = Math.max(plancha.largoCm, 1);
  const h = Math.max(plancha.anchoCm, 1);
  const pad = 8;
  const patternId = `hatch-${plancha.chapaId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      role="img"
      aria-label={`Plancha ${plancha.bulto} ${plancha.pctAprovechado.toFixed(0)} por ciento aprovechada`}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <pattern id={patternId} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="12" stroke="#c4a35a" strokeWidth="4" opacity="0.55" />
        </pattern>
      </defs>
      <rect x={0} y={0} width={w} height={h} fill="#f4efe6" stroke="#1a1a1a" strokeWidth={Math.max(w, h) / 180} />
      {plancha.sobrantes.map((s, i) => (
        <rect
          key={`s-${i}`}
          x={s.xCm}
          y={s.yCm}
          width={s.largoCm}
          height={s.anchoCm}
          fill={`url(#${patternId})`}
          stroke="#a8843d"
          strokeWidth={Math.max(w, h) / 400}
        />
      ))}
      {plancha.piezas.map((p, i) => (
        <g key={p.key}>
          <rect
            x={p.xCm}
            y={p.yCm}
            width={p.largoCm}
            height={p.anchoCm}
            fill={PIEZA_COLORS[i % PIEZA_COLORS.length]}
            stroke="#0b0b0b"
            strokeWidth={Math.max(w, h) / 350}
          />
          {p.largoCm > w * 0.12 && p.anchoCm > h * 0.1 ? (
            <text
              x={p.xCm + p.largoCm / 2}
              y={p.yCm + p.anchoCm / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={Math.min(p.largoCm, p.anchoCm) / 7}
            >
              {p.label}
            </text>
          ) : null}
        </g>
      ))}
      <rect
        x={pad / 20}
        y={pad / 20}
        width={w - pad / 10}
        height={h - pad / 10}
        fill="none"
        stroke="#111"
        strokeWidth={Math.max(w, h) / 220}
      />
    </svg>
  );
}
