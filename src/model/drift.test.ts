import { describe, expect, it } from "vitest";
import { driftVector } from "./drift.js";
import type { DriftParams, Vec2 } from "./types.js";

const params: DriftParams = { kappa: 2.5, p: 0.5 };
const R0 = 50;

describe("driftVector", () => {
  it("é nula sem vento", () => {
    const d = driftVector(30, R0, params, { x: 0, y: 0 });
    expect(d.x).toBe(0);
    expect(d.y).toBe(0);
  });

  it("na ponta (r=R0) tem módulo = κ·|w|", () => {
    const wind: Vec2 = { x: 4, y: 0 };
    const d = driftVector(R0, R0, params, wind);
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(params.kappa * 4, 9);
  });

  it("a periferia deriva mais que o centro (cresce com r para p>0)", () => {
    const wind: Vec2 = { x: 3, y: 0 };
    const inner = Math.hypot(...Object.values(driftVector(10, R0, params, wind)));
    const outer = Math.hypot(...Object.values(driftVector(45, R0, params, wind)));
    expect(outer).toBeGreaterThan(inner);
  });

  it("é paralela ao vento (mesma direção)", () => {
    const wind: Vec2 = { x: 3, y: 4 }; // |w| = 5
    const d = driftVector(25, R0, params, wind);
    // d = factor·w → componentes proporcionais a (3,4)
    expect(d.x / d.y).toBeCloseTo(3 / 4, 9);
    const factor = params.kappa * Math.pow(25 / R0, params.p);
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(factor * 5, 9);
  });

  it("escala linearmente com o módulo do vento", () => {
    const d1 = driftVector(30, R0, params, { x: 2, y: 0 });
    const d2 = driftVector(30, R0, params, { x: 6, y: 0 });
    expect(d2.x / d1.x).toBeCloseTo(3, 9);
  });

  it("com p=1 a deriva é linear em r", () => {
    const linear: DriftParams = { kappa: 1, p: 1 };
    const wind: Vec2 = { x: 1, y: 0 };
    expect(driftVector(20, R0, linear, wind).x).toBeCloseTo((20 / R0) * 1, 9);
    expect(driftVector(40, R0, linear, wind).x).toBeCloseTo((40 / R0) * 1, 9);
  });
});
