/**
 * Camada 5 (parte 1) — campo: sobreposição de passagens adjacentes.
 *
 * Ver `docs/modelo_footprint_rega.pdf` §6 e CLAUDE.md §3.
 *
 * Sobre uma faixa de largura `S` (espaçamento entre passagens), o mapa combinado
 * resulta de somar a passagem com cópias suas deslocadas de `S`:
 *
 *   z(y) = Σ_k D_ef(y − k·S)
 *
 * Como o campo é periódico em `y` com período `S` (no limite de passagens
 * infinitas), basta avaliar `z(y)` sobre uma faixa representativa de largura `S`.
 */

import type { TransversalProfile } from "./types.js";

/** Faixa de campo combinada: `z` amostrado uniformemente em `y`. */
export interface FieldStrip {
  /** Posição `y` da primeira amostra (centro da célula), m. */
  yMin: number;
  /** Passo de amostragem em `y`, m. */
  dy: number;
  /** Aplicação combinada `z(y)` em cada amostra, mm. */
  z: Float64Array;
}

/**
 * Amostra o perfil de passagem `D(y)` num `y` arbitrário por interpolação linear.
 * Fora do suporte devolve 0; nas bordas faz rampa suave para 0.
 */
export function sampleProfile(profile: TransversalProfile, y: number): number {
  const { yMin, dy, depth } = profile;
  const n = depth.length;
  if (n === 0) return 0;
  const pos = (y - yMin) / dy;
  if (pos <= -1 || pos >= n) return 0;
  const i = Math.floor(pos);
  const frac = pos - i;
  const a = i >= 0 ? depth[i]! : 0;
  const b = i + 1 < n ? depth[i + 1]! : 0;
  return a * (1 - frac) + b * frac;
}

/**
 * Aplicação combinada `z(y) = Σ_k D(y − k·S)` num ponto `y`, somando todas as
 * passagens cujo contributo é não-nulo.
 *
 * @param spacing espaçamento entre faixas `S`, m (> 0).
 */
export function fieldValue(profile: TransversalProfile, spacing: number, y: number): number {
  if (spacing <= 0) throw new RangeError("spacing deve ser > 0");
  const { yMin, dy, depth } = profile;
  const yMax = yMin + depth.length * dy;
  // y − k·S deve cair no suporte [yMin, yMax]; +1 de margem para apanhar as rampas.
  const kLo = Math.ceil((y - yMax) / spacing) - 1;
  const kHi = Math.floor((y - yMin) / spacing) + 1;
  let z = 0;
  for (let k = kLo; k <= kHi; k++) {
    z += sampleProfile(profile, y - k * spacing);
  }
  return z;
}

/**
 * Constrói uma faixa representativa do campo combinado: avalia `z(y)` em
 * `samples` pontos igualmente espaçados sobre um período `[0, S)`.
 *
 * @param spacing espaçamento entre faixas `S`, m (> 0).
 * @param samples número de amostras na faixa (> 0).
 */
export function combineField(
  profile: TransversalProfile,
  spacing: number,
  samples: number,
): FieldStrip {
  if (spacing <= 0) throw new RangeError("spacing deve ser > 0");
  if (samples <= 0) throw new RangeError("samples deve ser > 0");
  const dy = spacing / samples;
  const z = new Float64Array(samples);
  for (let i = 0; i < samples; i++) {
    z[i] = fieldValue(profile, spacing, (i + 0.5) * dy);
  }
  return { yMin: 0.5 * dy, dy, z };
}
