import { describe, expect, it } from "vitest";
import { createGrid, depositPass, gridVolume, windLoss, type DepositArgs } from "./deposit.js";
import type { MachineProfile } from "./types.js";

const machine: MachineProfile = {
  name: "Big Gun (teste)",
  rangeCoeff: 18, // R0 = 18·√8 ≈ 50.9 m
  flow: 0.02, // 20 L/s
  sector: Math.PI, // meio círculo
  m: 2,
  n: 1,
};

/** Grelha folgada para garantir que nenhuma partícula sai (raio ≈ R0 + κ·|w|). */
function spaciousGrid(half: number, cellSize = 1) {
  return { cellSize, xMin: -half, xMax: half, yMin: -half, yMax: half };
}

function baseArgs(overrides: Partial<DepositArgs> = {}): DepositArgs {
  return {
    machine,
    pressureBar: 8,
    drift: { kappa: 2.5, p: 0.5 },
    wind: { x: 0, y: 0 },
    grid: spaciousGrid(120),
    particles: 50000,
    dwell: 60,
    loss: 0,
    sectorCenter: 0,
    seed: 1,
    ...overrides,
  };
}

describe("windLoss", () => {
  it("perda(0) = L0", () => {
    expect(windLoss(0, { L0: 0.1, L1: 0.03 })).toBeCloseTo(0.1, 9);
  });

  it("cresce com o vento: L0 + L1·w", () => {
    expect(windLoss(5, { L0: 0.1, L1: 0.03 })).toBeCloseTo(0.25, 9);
  });

  it("satura no teto de 0.4", () => {
    expect(windLoss(100, { L0: 0.1, L1: 0.03 })).toBe(0.4);
  });

  it("nunca é negativa", () => {
    expect(windLoss(0, { L0: -1, L1: 0.03 })).toBe(0);
  });
});

describe("createGrid / gridVolume", () => {
  it("dimensiona a grelha a partir da spec", () => {
    const g = createGrid({ cellSize: 2, xMin: -10, xMax: 10, yMin: -5, yMax: 5 });
    expect(g.cols).toBe(10);
    expect(g.rows).toBe(5);
    expect(g.data.length).toBe(50);
  });

  it("soma volume: 1 mm sobre 1 m² = 1 L = 1e-3 m³", () => {
    const g = createGrid({ cellSize: 1, xMin: 0, xMax: 2, yMin: 0, yMax: 2 });
    g.data.fill(1); // 1 mm em cada uma das 4 células de 1 m²
    expect(gridVolume(g)).toBeCloseTo(4e-3, 12);
  });
});

describe("depositPass — conservação de água (teste-mestre)", () => {
  it("sem perda: volume depositado = volume aplicado", () => {
    const r = depositPass(baseArgs({ loss: 0 }));
    expect(r.outOfBounds).toBe(0);
    expect(r.appliedVolume).toBeCloseTo(machine.flow * 60, 12);
    expect(r.depositedVolume).toBeCloseTo(r.appliedVolume, 9);
  });

  it("com perda: volume depositado = aplicado × (1 − perda)", () => {
    const loss = 0.2;
    const r = depositPass(baseArgs({ loss }));
    expect(r.outOfBounds).toBe(0);
    expect(r.depositedVolume).toBeCloseTo(r.appliedVolume * (1 - loss), 9);
  });

  it("conserva também com vento (deriva não cria nem destrói água)", () => {
    const loss = windLoss(6, { L0: 0.1, L1: 0.03 });
    const r = depositPass(baseArgs({ wind: { x: 6, y: 0 }, loss, grid: spaciousGrid(160) }));
    expect(r.outOfBounds).toBe(0);
    expect(r.depositedVolume).toBeCloseTo(r.appliedVolume * (1 - loss), 9);
  });

  it("é determinística para a mesma seed", () => {
    const a = depositPass(baseArgs({ seed: 123 }));
    const b = depositPass(baseArgs({ seed: 123 }));
    expect(Array.from(b.grid.data)).toEqual(Array.from(a.grid.data));
  });
});

describe("depositPass — física do footprint", () => {
  it("sem vento o centroide fica na origem (simetria do setor em torno de +x)", () => {
    const r = depositPass(baseArgs({ wind: { x: 0, y: 0 } }));
    const { cy } = centroid(r.grid);
    expect(Math.abs(cy)).toBeLessThan(1); // simétrico em y
  });

  it("o vento desloca o centroide para sotavento (downwind)", () => {
    const calm = centroid(depositPass(baseArgs({ wind: { x: 0, y: 0 } })).grid);
    const windy = centroid(
      depositPass(baseArgs({ wind: { x: 8, y: 0 }, grid: spaciousGrid(180) })).grid,
    ).cx;
    expect(windy).toBeGreaterThan(calm.cx);
  });

  it("partículas fora dos limites são contabilizadas (grelha apertada)", () => {
    const r = depositPass(baseArgs({ grid: spaciousGrid(20) })); // R0 ≈ 51 > 20
    expect(r.outOfBounds).toBeGreaterThan(0);
    expect(r.depositedVolume).toBeLessThan(r.appliedVolume);
  });
});

/** Centroide ponderado pela água depositada (coordenadas em metros). */
function centroid(grid: {
  cols: number;
  rows: number;
  data: Float64Array;
  spec: { cellSize: number; xMin: number; yMin: number };
}): { cx: number; cy: number } {
  const { cols, rows, data, spec } = grid;
  let sw = 0;
  let sx = 0;
  let sy = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const w = data[row * cols + col]!;
      if (w === 0) continue;
      const x = spec.xMin + (col + 0.5) * spec.cellSize;
      const y = spec.yMin + (row + 0.5) * spec.cellSize;
      sw += w;
      sx += w * x;
      sy += w * y;
    }
  }
  return { cx: sx / sw, cy: sy / sw };
}
