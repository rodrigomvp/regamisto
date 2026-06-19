/** Mapa de cor viridis (perceptualmente uniforme) para a profundidade de água. */

type RGB = [number, number, number];

const STOPS: RGB[] = [
  [68, 1, 84], // seco (baixo)
  [59, 82, 139],
  [33, 144, 141],
  [93, 201, 99],
  [253, 231, 37], // encharcado (alto)
];

/** Cor viridis para `t ∈ [0,1]`. */
export function viridis(t: number): RGB {
  const x = Math.min(Math.max(t, 0), 1) * (STOPS.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = STOPS[i]!;
  const b = STOPS[Math.min(i + 1, STOPS.length - 1)]!;
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

/** Cor viridis como string CSS. */
export function viridisCss(t: number): string {
  const [r, g, b] = viridis(t);
  return `rgb(${r}, ${g}, ${b})`;
}
