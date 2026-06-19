/**
 * Camadas 3–4 — método de partículas: deposição de uma passagem numa grelha.
 *
 * Ver `docs/modelo_footprint_rega.pdf` §8 e CLAUDE.md §3.
 *
 * Em vez de resolver os integrais (6)/(7) em forma fechada, amostram-se `M`
 * partículas no padrão de ar parado (raio `r ~ g(r)`, ângulo uniforme no setor
 * `Φ`), desloca-se cada uma pela deriva do vento `Δ(r)` e acumulam-se numa
 * grelha. O perfil `D(y)` e o fator físico `1/r` emergem da densidade de
 * partículas, sem cálculo explícito.
 *
 * Cada partícula transporta uma fração igual do volume aplicado. O teste-mestre
 * é a conservação de água: volume depositado = volume aplicado × (1 − perda).
 */

import { driftVector } from "./drift.js";
import { stillAirRadius } from "./jet.js";
import { makeRadialSampler } from "./radial.js";
import type { DriftParams, Grid, GridSpec, LossParams, MachineProfile, Vec2 } from "./types.js";

/** Limita `x` ao intervalo `[lo, hi]`. */
function clamp(x: number, lo: number, hi: number): number {
  return Math.min(Math.max(x, lo), hi);
}

/**
 * PRNG mulberry32 — gerador determinístico e rápido em `[0, 1)`.
 * Permite testes reprodutíveis a partir de uma seed inteira.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Perda por vento (WDEL) como fator de escala global (camada 4):
 *
 *   perda(w) = clamp(L0 + L1·w, 0, 0.4)
 *
 * @param windSpeed módulo do vento `w`, m/s.
 */
export function windLoss(windSpeed: number, params: LossParams): number {
  return clamp(params.L0 + params.L1 * windSpeed, 0, 0.4);
}

/** Cria uma grelha vazia (todos os valores a 0) a partir da sua especificação. */
export function createGrid(spec: GridSpec): Grid {
  if (spec.cellSize <= 0) throw new RangeError("cellSize deve ser > 0");
  if (spec.xMax <= spec.xMin || spec.yMax <= spec.yMin) {
    throw new RangeError("limites da grelha inválidos");
  }
  const cols = Math.max(1, Math.round((spec.xMax - spec.xMin) / spec.cellSize));
  const rows = Math.max(1, Math.round((spec.yMax - spec.yMin) / spec.cellSize));
  return { spec, cols, rows, data: new Float64Array(cols * rows) };
}

/** Soma o volume total de água numa grelha de profundidades (mm), em m³. */
export function gridVolume(grid: Grid): number {
  const cellArea = grid.spec.cellSize * grid.spec.cellSize; // m²
  let sumMm = 0;
  for (let i = 0; i < grid.data.length; i++) sumMm += grid.data[i]!;
  // mm → m (×1e-3) × área (m²) = m³
  return sumMm * 1e-3 * cellArea;
}

/** Argumentos de {@link depositPass}. */
export interface DepositArgs {
  machine: MachineProfile;
  /** Pressão de operação `P`, bar (usada para derivar `R0`). */
  pressureBar: number;
  /** Parâmetros de deriva `(κ, p)`. */
  drift: DriftParams;
  /** Vetor do vento descendente (downwind), m/s. */
  wind: Vec2;
  /** Limites e resolução da grelha de saída. */
  grid: GridSpec;
  /** Número de partículas `M`. */
  particles: number;
  /** Tempo de permanência da passagem, s (volume aplicado = Q·dwell). */
  dwell: number;
  /** Fração de perda por vento ∈ [0, 0.4] (ver {@link windLoss}). */
  loss: number;
  /** Ângulo central do setor regado, radianos (default 0 → eixo +x). */
  sectorCenter?: number;
  /** Seed do PRNG (default 1). */
  seed?: number;
}

/** Resultado de uma passagem de deposição. */
export interface DepositResult {
  /** Grelha de profundidade aplicada, mm por célula. */
  grid: Grid;
  /** Volume aplicado antes de perdas, m³. */
  appliedVolume: number;
  /** Volume efetivamente depositado na grelha, m³ (= aplicado×(1−perda) se nada sair). */
  depositedVolume: number;
  /** Nº de partículas que caíram fora dos limites da grelha (água perdida do mapa). */
  outOfBounds: number;
}

/**
 * Deposita uma passagem do canhão por método de partículas.
 *
 * Cada partícula transporta `Q·dwell·(1−perda)/M` m³. Se a grelha cobrir todo o
 * padrão (raio máximo ≈ R0 + κ·|w|), nenhuma partícula sai e
 * `depositedVolume = appliedVolume·(1−perda)` exatamente — a conservação de água.
 */
export function depositPass(args: DepositArgs): DepositResult {
  const { machine, pressureBar, drift, wind, grid: spec } = args;
  const sectorCenter = args.sectorCenter ?? 0;
  const seed = args.seed ?? 1;
  if (args.particles <= 0) throw new RangeError("particles deve ser > 0");
  if (args.dwell <= 0) throw new RangeError("dwell deve ser > 0");

  const R0 = stillAirRadius(pressureBar, machine.rangeCoeff);
  const sampler = makeRadialSampler(R0, machine.m, machine.n);
  const rng = mulberry32(seed);

  const grid = createGrid(spec);
  const { cellSize, xMin, yMin } = spec;
  const { cols, rows } = grid;

  const appliedVolume = machine.flow * args.dwell; // m³
  const depositedTotal = appliedVolume * (1 - args.loss); // m³
  // Volume por partícula → incremento de profundidade (mm) por célula.
  const cellArea = cellSize * cellSize; // m²
  const depthPerParticleMm = (depositedTotal / args.particles / cellArea) * 1e3;

  let outOfBounds = 0;

  for (let i = 0; i < args.particles; i++) {
    const r = sampler(rng());
    // Ângulo uniforme no setor [sectorCenter − Φ/2, sectorCenter + Φ/2].
    const theta = sectorCenter + (rng() - 0.5) * machine.sector;
    const baseX = r * Math.cos(theta);
    const baseY = r * Math.sin(theta);
    const d = driftVector(r, R0, drift, wind);
    const x = baseX + d.x;
    const y = baseY + d.y;

    const col = Math.floor((x - xMin) / cellSize);
    const row = Math.floor((y - yMin) / cellSize);
    if (col < 0 || col >= cols || row < 0 || row >= rows) {
      outOfBounds++;
      continue;
    }
    grid.data[row * cols + col]! += depthPerParticleMm;
  }

  return {
    grid,
    appliedVolume,
    depositedVolume: gridVolume(grid),
    outOfBounds,
  };
}
