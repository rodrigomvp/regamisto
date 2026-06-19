/**
 * Camada de ligação UI ↔ motor: compõe as funções puras de `model/` a partir
 * dos inputs dos sliders e devolve tudo o que a UI precisa de desenhar.
 *
 * Esta camada NÃO altera o motor — apenas o consome. É também o único sítio (na
 * ausência de `weather/`) onde se aplica a conversão de unidades para SI e a
 * convenção do vento (direção "de onde sopra" → vetor para onde "vai", +180°).
 *
 * Visualização: duas vistas do MESMO footprint de deposição (mesmas unidades e
 * mesma escala de cor) — a passagem isolada e o campo (faixas sobrepostas a `S`).
 * As métricas CU/DU/média vêm sempre de `field.ts` + `uniformity.ts` sobre o
 * perfil colapsado `z(y)`, que é a fonte autoritativa.
 */

import {
  christiansenCU,
  combineField,
  depositPass,
  distributionUniformity,
  mean,
  stillAirRadius,
  windLoss,
} from "../model/index.js";
import type {
  DriftParams,
  Grid,
  LossParams,
  MachineProfile,
  TransversalProfile,
  Vec2,
} from "../model/index.js";

/** Perfil de canhão de demonstração (priors; perfis reais iriam para `data/`). */
export const DEFAULT_MACHINE: MachineProfile = {
  name: "Big Gun (prior)",
  rangeCoeff: 19, // R0 = 19·√P  → ≈ 54 m a 8 bar
  flow: 0.02, // Q = 20 L/s ≈ 72 m³/h
  sector: (300 * Math.PI) / 180, // setor de 300°
  m: 2,
  n: 1, // pico no terço exterior
};

/** Priors de calibração (CLAUDE.md §3). */
export const DRIFT_PRIORS: DriftParams = { kappa: 2.5, p: 0.5 };
export const LOSS_PRIORS: LossParams = { L0: 0.1, L1: 0.03 };

/** Inputs dos sliders, já em SI (m/s, m, bar). */
export interface SimInputs {
  /** Módulo do vento `w`, m/s. */
  windSpeed: number;
  /** Direção DE ONDE o vento sopra, graus de bússola. */
  windFromDeg: number;
  /** Espaçamento entre faixas `S`, m. */
  spacing: number;
  /** Pressão de operação `P`, bar. */
  pressureBar: number;
  /** Velocidade de marcha `u`, m/s. */
  marchSpeed: number;
}

/**
 * Converte vento meteorológico (módulo + direção de onde sopra) no vetor
 * descendente (downwind) no referencial do terreno.
 *
 * Convenção (CLAUDE.md §5): direção para onde o vento VAI = `fromDeg + 180°`.
 * Rumos de bússola: 0° = Norte, sentido horário. Eixos do terreno: x = Este
 * (direção de marcha), y = Norte.
 */
export function windToVector(speed: number, fromDeg: number): Vec2 {
  const toRad = ((fromDeg + 180) * Math.PI) / 180;
  return { x: speed * Math.sin(toRad), y: speed * Math.cos(toRad) };
}

const GRID_N = 132; // resolução da grelha de deposição (células por lado)
const PARTICLES = 120000; // partículas por passagem (suave e rápido para "ao vivo")
const DWELL = 1; // tempo de integração (cancela-se em D(y))
const STRIP_SAMPLES = 240; // amostras de z(y) num período para CU/DU
const SEED = 1; // determinístico → sem cintilação entre recomputações

/** Resultado da deposição de uma passagem: a grelha 2D + dados derivados. */
interface DepositOut {
  grid: Grid;
  windVec: Vec2;
  loss: number;
}

/** Deposita a footprint 2D de uma passagem isolada (método de partículas). */
function buildDeposit(inputs: SimInputs, machine: MachineProfile): DepositOut {
  const windVec = windToVector(inputs.windSpeed, inputs.windFromDeg);
  const loss = windLoss(inputs.windSpeed, LOSS_PRIORS);
  const R0 = stillAirRadius(inputs.pressureBar, machine.rangeCoeff);
  const maxDrift = DRIFT_PRIORS.kappa * inputs.windSpeed; // deriva máxima na ponta
  const half = R0 + maxDrift + 5;
  const cellSize = (2 * half) / GRID_N;

  const { grid } = depositPass({
    machine,
    pressureBar: inputs.pressureBar,
    drift: DRIFT_PRIORS,
    wind: windVec,
    grid: { cellSize, xMin: -half, xMax: half, yMin: -half, yMax: half },
    particles: PARTICLES,
    dwell: DWELL,
    loss,
    sectorCenter: 0,
    seed: SEED,
  });
  return { grid, windVec, loss };
}

/**
 * Colapsa a footprint 2D ao longo do eixo de marcha (x) no perfil transversal
 * `D(y)` em mm, incluindo a física da velocidade de marcha `u`
 * (`D = (1/u)·∫ I dx`): marcha mais lenta ⇒ mais água por área.
 */
function collapseToProfile(grid: Grid, marchSpeed: number): TransversalProfile {
  const { rows, cols, data, spec } = grid;
  const u = Math.max(marchSpeed, 1e-6);
  const scale = spec.cellSize / (u * DWELL);
  const depth = new Float64Array(rows);
  for (let r = 0; r < rows; r++) {
    let sum = 0;
    const base = r * cols;
    for (let c = 0; c < cols; c++) sum += data[base + c]!;
    depth[r] = sum * scale;
  }
  return { yMin: spec.yMin + 0.5 * spec.cellSize, dy: spec.cellSize, depth };
}

/**
 * Sobrepõe a footprint 2D consigo mesma, deslocada de `±k·S` ao longo de `y`,
 * dando o mapa 2D do campo `z(x,y) = Σ_k footprint(x, y − kS)`. É a versão 2D de
 * `z(y) = Σ_k D(y − kS)` (o seu colapso em x coincide com o de `field.ts`).
 */
function overlapAlongY(grid: Grid, spacing: number): Grid {
  const { rows, cols, data, spec } = grid;
  const out = new Float64Array(rows * cols);
  const kMax = Math.ceil((rows * spec.cellSize) / spacing) + 1;
  for (let k = -kMax; k <= kMax; k++) {
    const shiftRows = Math.round((k * spacing) / spec.cellSize);
    for (let rt = 0; rt < rows; rt++) {
      const rs = rt - shiftRows;
      if (rs < 0 || rs >= rows) continue;
      const tBase = rt * cols;
      const sBase = rs * cols;
      for (let c = 0; c < cols; c++) out[tBase + c]! += data[sBase + c]!;
    }
  }
  return { spec, cols, rows, data: out };
}

/** Suavização 3×3 (box blur) só para visualização — atenua o ruído de partículas. */
function smooth(grid: Grid): Grid {
  const { rows, cols, data, spec } = grid;
  const out = new Float64Array(rows * cols);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let sum = 0;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        const rr = r + dr;
        if (rr < 0 || rr >= rows) continue;
        for (let dc = -1; dc <= 1; dc++) {
          const cc = c + dc;
          if (cc < 0 || cc >= cols) continue;
          sum += data[rr * cols + cc]!;
          count++;
        }
      }
      out[r * cols + c] = sum / count;
    }
  }
  return { spec, cols, rows, data: out };
}

/** Intervalo [min, max] dos valores de várias grelhas (para a escala de cor). */
function dataRange(grids: Grid[]): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const g of grids) {
    for (let i = 0; i < g.data.length; i++) {
      const v = g.data[i]!;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!Number.isFinite(min)) return { min: 0, max: 1 };
  return { min, max: max > min ? max : min + 1 };
}

/** Tudo o que a UI desenha a partir de um conjunto de inputs. */
export interface SimResult {
  /** Footprint 2D de uma passagem isolada (mm), suavizada para display. */
  passGrid: Grid;
  /** Mapa 2D do campo (faixas sobrepostas a `S`), mesma unidade e escala. */
  fieldGrid: Grid;
  /** Escala de cor partilhada pelas duas vistas (min–max dos dados atuais). */
  colorMin: number;
  colorMax: number;
  /** Vetor do vento descendente (downwind), m/s. */
  windVec: Vec2;
  /** CU de Christiansen, %. */
  cu: number;
  /** DU low-quarter, fração [0,1]. */
  du: number;
  /** Aplicação média no campo, mm. */
  meanDepth: number;
  /** Perda por vento (WDEL) aplicada, fração [0,0.4]. */
  loss: number;
}

/** Corre toda a cadeia do motor para os inputs dados. */
export function simulate(inputs: SimInputs, machine = DEFAULT_MACHINE): SimResult {
  const { grid, windVec, loss } = buildDeposit(inputs, machine);

  // Métricas autoritativas: colapso → field.ts → uniformity.ts.
  const profile = collapseToProfile(grid, inputs.marchSpeed);
  const strip = combineField(profile, inputs.spacing, STRIP_SAMPLES);

  // Vistas: footprint isolada e campo sobreposto, na mesma unidade e escala.
  const passGrid = smooth(grid);
  const fieldGrid = smooth(overlapAlongY(grid, inputs.spacing));
  const { min, max } = dataRange([passGrid, fieldGrid]);

  return {
    passGrid,
    fieldGrid,
    colorMin: min,
    colorMax: max,
    windVec,
    cu: christiansenCU(strip.z),
    du: distributionUniformity(strip.z),
    meanDepth: mean(strip.z),
    loss,
  };
}
