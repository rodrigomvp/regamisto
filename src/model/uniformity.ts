/**
 * Camada 5 (parte 2) — métricas de uniformidade sobre o mapa combinado.
 *
 * Ver `docs/modelo_footprint_rega.pdf` §6 e CLAUDE.md §3.
 *
 *   CU = 100·(1 − Σ|z_i − z̄| / Σ z_i)   (Coef. de Uniformidade de Christiansen)
 *   DU = z̄(quarto mais seco) / z̄        (Distribution Uniformity, low-quarter)
 */

/** Média aritmética `z̄`. Devolve 0 para vetor vazio. */
export function mean(values: ArrayLike<number>): number {
  const n = values.length;
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += values[i]!;
  return sum / n;
}

/**
 * Coeficiente de Uniformidade de Christiansen (CU), em percentagem [0, 100].
 *
 *   CU = 100·(1 − Σ|z_i − z̄| / Σ z_i)
 *
 * Um campo perfeitamente uniforme dá CU = 100. Campo todo seco (Σ z = 0) é
 * indefinido; devolve-se 0.
 */
export function christiansenCU(values: ArrayLike<number>): number {
  const n = values.length;
  if (n === 0) return 0;
  const m = mean(values);
  if (m === 0) return 0;
  let absDev = 0;
  for (let i = 0; i < n; i++) absDev += Math.abs(values[i]! - m);
  const sum = m * n; // Σ z_i = n·z̄
  return 100 * (1 - absDev / sum);
}

/**
 * Distribution Uniformity (DU) low-quarter, em [0, 1].
 *
 *   DU = média(quarto mais seco) / z̄
 *
 * O "quarto mais seco" é o conjunto dos `round(n/4)` menores valores (mínimo 1).
 * Campo uniforme dá DU = 1. Campo todo seco devolve 0.
 */
export function distributionUniformity(values: ArrayLike<number>): number {
  const n = values.length;
  if (n === 0) return 0;
  const overall = mean(values);
  if (overall === 0) return 0;
  const sorted = Array.from(values as ArrayLike<number>).sort((a, b) => a - b);
  const q = Math.max(1, Math.round(n / 4));
  let sum = 0;
  for (let i = 0; i < q; i++) sum += sorted[i]!;
  return sum / q / overall;
}

/** Resumo de uniformidade: média (mm), CU (%) e DU (fração). */
export interface UniformitySummary {
  mean: number;
  cu: number;
  du: number;
}

/** Calcula média, CU e DU de uma só passagem pelos dados. */
export function uniformity(values: ArrayLike<number>): UniformitySummary {
  return {
    mean: mean(values),
    cu: christiansenCU(values),
    du: distributionUniformity(values),
  };
}
