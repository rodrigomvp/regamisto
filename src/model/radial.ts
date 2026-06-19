/**
 * Camada 3 — perfil radial (forma Beta), intensidade de aplicação e amostragem.
 *
 * Ver `docs/modelo_footprint_rega.pdf` §4 e CLAUDE.md §3.
 */

/** log Γ(x) — aproximação de Lanczos (g = 7), válida para x > 0. */
export function logGamma(x: number): number {
  // Coeficientes de Lanczos g=7, n=9.
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    // Reflexão: Γ(x)Γ(1-x) = π / sin(πx)
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  x -= 1;
  let a = c[0]!;
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i]! / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** log B(a, b) = logΓ(a) + logΓ(b) − logΓ(a+b). */
export function logBeta(a: number, b: number): number {
  return logGamma(a) + logGamma(b) - logGamma(a + b);
}

/** Função Beta B(a, b). */
export function betaFunction(a: number, b: number): number {
  return Math.exp(logBeta(a, b));
}

/**
 * Densidade radial Beta `g(r)`, normalizada de forma a `∫₀^R0 g dr = 1`:
 *
 *   g(r) = (1 / (R0·B(m+1, n+1))) · (r/R0)^m · (1 − r/R0)^n
 *
 * Devolve 0 fora de `(0, R0)`.
 *
 * @returns densidade por metro (unidade 1/m).
 */
export function radialDensity(r: number, R0: number, m: number, n: number): number {
  if (R0 <= 0) throw new RangeError("R0 deve ser > 0");
  if (r <= 0 || r >= R0) return 0;
  const t = r / R0;
  const norm = 1 / (R0 * betaFunction(m + 1, n + 1));
  return norm * Math.pow(t, m) * Math.pow(1 - t, n);
}

/**
 * Raio do pico da densidade radial: `r_pico = R0·m/(m+n)`.
 * (Para m=0 o pico está em r=0; para n=0 está em r=R0.)
 */
export function radialPeak(R0: number, m: number, n: number): number {
  if (m + n === 0) return 0;
  return (R0 * m) / (m + n);
}

/**
 * Intensidade de aplicação (profundidade por unidade de tempo) ao raio `r`:
 *
 *   I(r) = Q·g(r) / (Φ·r)
 *
 * O fator `1/r` é físico: divide pela área do anel correspondente. Explica
 * porque o centro encharca e a periferia fica curta mesmo sem vento.
 *
 * @param r raio, m.
 * @param Q caudal, m³/s.
 * @param sector setor angular `Φ`, radianos.
 * @param R0 raio em ar parado, m.
 * @param m,n forma radial Beta.
 * @returns intensidade (m/s de profundidade).
 */
export function intensity(
  r: number,
  Q: number,
  sector: number,
  R0: number,
  m: number,
  n: number,
): number {
  if (r <= 0 || r >= R0) return 0;
  if (sector <= 0) throw new RangeError("sector deve ser > 0");
  return (Q * radialDensity(r, R0, m, n)) / (sector * r);
}

/**
 * Amostrador radial por inversão de CDF: devolve uma função que mapeia
 * `u ∈ [0,1)` num raio `r` distribuído segundo `g(r)`.
 *
 * Constrói a CDF discreta (regra do trapézio) sobre `bins` intervalos em
 * `t = r/R0` e inverte-a com pesquisa binária + interpolação linear. Determinístico.
 */
export function makeRadialSampler(
  R0: number,
  m: number,
  n: number,
  bins = 2048,
): (u: number) => number {
  if (R0 <= 0) throw new RangeError("R0 deve ser > 0");
  const dt = 1 / bins;
  // pdf não-normalizada em t: t^m·(1−t)^n
  const pdf = (t: number): number => Math.pow(t, m) * Math.pow(1 - t, n);
  const cdf = new Float64Array(bins + 1);
  let acc = 0;
  let prev = pdf(0);
  for (let i = 1; i <= bins; i++) {
    const f = pdf(i * dt);
    acc += 0.5 * (prev + f) * dt;
    cdf[i] = acc;
    prev = f;
  }
  const total = acc;
  return (u: number): number => {
    const target = u * total;
    // Pesquisa binária do primeiro índice com cdf[i] >= target.
    let lo = 1;
    let hi = bins;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid]! < target) lo = mid + 1;
      else hi = mid;
    }
    const c0 = cdf[lo - 1]!;
    const c1 = cdf[lo]!;
    const frac = c1 > c0 ? (target - c0) / (c1 - c0) : 0;
    const t = (lo - 1 + frac) * dt;
    return t * R0;
  };
}
