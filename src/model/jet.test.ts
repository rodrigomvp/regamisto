import { describe, expect, it } from "vitest";
import { BAR_TO_PA, DISCHARGE_COEFF, WATER_DENSITY, jetVelocity, stillAirRadius } from "./jet.js";

describe("jetVelocity", () => {
  it("dá ~40 m/s a 8 bar com Cv=1 (valor de referência do PDF)", () => {
    expect(jetVelocity(8, 1)).toBeCloseTo(40, 6);
  });

  it("aplica o coeficiente de descarga por defeito (Cv≈0.96)", () => {
    expect(jetVelocity(8)).toBeCloseTo(0.96 * 40, 6);
    expect(jetVelocity(8)).toBeCloseTo(jetVelocity(8, 1) * DISCHARGE_COEFF, 9);
  });

  it("segue a equação de Torricelli v0 = Cv·√(2P/ρ)", () => {
    const P = 6.5;
    const expected = DISCHARGE_COEFF * Math.sqrt((2 * P * BAR_TO_PA) / WATER_DENSITY);
    expect(jetVelocity(P)).toBeCloseTo(expected, 9);
  });

  it("escala com √P", () => {
    expect(jetVelocity(4) / jetVelocity(1)).toBeCloseTo(2, 9);
    expect(jetVelocity(9) / jetVelocity(1)).toBeCloseTo(3, 9);
  });

  it("é 0 a pressão nula e rejeita pressão negativa", () => {
    expect(jetVelocity(0)).toBe(0);
    expect(() => jetVelocity(-1)).toThrow(RangeError);
  });
});

describe("stillAirRadius", () => {
  it("aplica R0 = c·√P", () => {
    expect(stillAirRadius(4, 20)).toBeCloseTo(40, 9); // 20·√4
    expect(stillAirRadius(9, 10)).toBeCloseTo(30, 9); // 10·√3
  });

  it("escala com √P", () => {
    const c = 18;
    expect(stillAirRadius(8, c) / stillAirRadius(2, c)).toBeCloseTo(2, 9);
  });

  it("rejeita entradas inválidas", () => {
    expect(() => stillAirRadius(-1, 10)).toThrow(RangeError);
    expect(() => stillAirRadius(5, 0)).toThrow(RangeError);
  });
});
