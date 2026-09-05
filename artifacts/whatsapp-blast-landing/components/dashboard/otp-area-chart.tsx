function formatTick(n: number) {
  if (n === 0) return '0';
  if (n >= 1000) {
    const k = n / 1000;
    return Number.isInteger(k) ? `${k}K` : `${k.toFixed(1)}K`;
  }
  return String(Math.round(n));
}

export function OtpAreaChart({
  labels,
  values,
  gradientId = 'otpAreaFill',
}: {
  labels: string[];
  values: number[];
  gradientId?: string;
}) {
  const width = 640;
  const height = 250;
  const pad = { top: 16, right: 12, bottom: 32, left: 40 };
  const peak = Math.max(1, ...values);
  const max = peak * 1.1;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const points = values.map((v, i) => {
    const x = pad.left + (i / Math.max(values.length - 1, 1)) * innerW;
    const y = pad.top + innerH - (v / max) * innerH;
    return { x, y, v, label: labels[i] };
  });

  const line = points.map((p) => `${p.x},${p.y}`).join(' ');
  const area = `${pad.left},${pad.top + innerH} ${line} ${pad.left + innerW},${pad.top + innerH}`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: pad.top + innerH * (1 - t),
    label: formatTick(max * t),
  }));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[250px]" role="img">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {yTicks.map((tick) => (
        <g key={`${tick.label}-${tick.y}`}>
          <line
            x1={pad.left}
            x2={width - pad.right}
            y1={tick.y}
            y2={tick.y}
            stroke="var(--color-border)"
            strokeDasharray="5 5"
          />
          <text
            x={pad.left - 8}
            y={tick.y + 4}
            textAnchor="end"
            className="fill-muted-foreground"
            fontSize="12"
          >
            {tick.label}
          </text>
        </g>
      ))}

      <polygon points={area} fill={`url(#${gradientId})`} />
      <polyline
        points={line}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {points.map((p, i) => {
        const show =
          points.length <= 8 ||
          i === 0 ||
          i === points.length - 1 ||
          i % Math.ceil(points.length / 6) === 0;
        if (!show) return null;
        return (
          <text
            key={`x-${p.label}-${i}`}
            x={p.x}
            y={height - 10}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize="12"
          >
            {p.label}
          </text>
        );
      })}
    </svg>
  );
}
