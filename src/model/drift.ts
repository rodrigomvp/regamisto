/**
 * Camada 2 — distorção pelo vento.
 *
 * Ver `docs/modelo_footprint_rega.pdf` §3 e CLAUDE.md §3.
 */

import type { DriftParams, Vec2 } from "./types.js";

/**
 * Deslocamento (deriva) de um elemento de água que, sem vento, cairia ao raio
 * `r` do canhão:
 *
 *   Δ(r) = κ·(r/R0)^p · w
 *
 * onde `w` é o vetor do vento já no referencial do terreno (m/s, a apontar
 * para onde o vento VAI). O fator `(r/R0)^p` cresce com o raio: a periferia
 * deriva mais que o centro. Reproduz num único mecanismo o encurtamento contra
 * o vento, o alongamento a favor e o desvio lateral com vento atravessado.
 *
 * @param r raio em ar parado, m.
 * @param R0 raio de alcance em ar parado, m.
 * @param params parâmetros calibráveis `(κ, p)`.
 * @param wind vetor do vento descendente (downwind), m/s.
 * @returns vetor de deriva, metros.
 */
export function driftVector(
  r: number,
  R0: number,
  params: DriftParams,
  wind: Vec2,
): Vec2 {
  if (R0 <= 0) throw new RangeError("R0 deve ser > 0");
  const factor = params.kappa * Math.pow(Math.max(r, 0) / R0, params.p);
  return { x: factor * wind.x, y: factor * wind.y };
}
