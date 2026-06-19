/**
 * Camada 1 — padrão em ar parado: velocidade de saída do jato e raio de alcance.
 *
 * Ver `docs/modelo_footprint_rega.pdf` §2 e CLAUDE.md §3.
 */

/** Coeficiente de descarga `Cv` (prior ≈ 0.96). */
export const DISCHARGE_COEFF = 0.96;

/** Densidade da água `ρ`, kg/m³. */
export const WATER_DENSITY = 1000;

/** Conversão de bar para Pascal. */
export const BAR_TO_PA = 1e5;

/**
 * Velocidade de saída do jato pela equação de Torricelli corrigida por `Cv`:
 *
 *   v0 = Cv·√(2P/ρ)
 *
 * Com P em Pa. Como √(2·1e5/ρ) = √200 ≈ 14.1, isto equivale a
 * `v0 ≈ Cv·14.1·√(P_bar)` m/s. Com Cv = 1 dá ≈ 40 m/s a 8 bar (realista).
 *
 * @param pressureBar pressão `P`, bar.
 * @param cv coeficiente de descarga (default {@link DISCHARGE_COEFF}).
 * @returns velocidade de saída `v0`, m/s.
 */
export function jetVelocity(pressureBar: number, cv: number = DISCHARGE_COEFF): number {
  if (pressureBar < 0) throw new RangeError("pressureBar deve ser >= 0");
  return cv * Math.sqrt((2 * pressureBar * BAR_TO_PA) / WATER_DENSITY);
}

/**
 * Raio de alcance em ar parado.
 *
 *   R0 = c·√P
 *
 * O coeficiente `c` vem da tabela do fabricante para cada par (bico, pressão).
 * A balística sem arrasto sobrestima o alcance em ~2×, por isso NÃO se usa aqui.
 *
 * @param pressureBar pressão `P`, bar.
 * @param rangeCoeff coeficiente `c`, m por √bar.
 * @returns raio `R0`, metros.
 */
export function stillAirRadius(pressureBar: number, rangeCoeff: number): number {
  if (pressureBar < 0) throw new RangeError("pressureBar deve ser >= 0");
  if (rangeCoeff <= 0) throw new RangeError("rangeCoeff deve ser > 0");
  return rangeCoeff * Math.sqrt(pressureBar);
}
