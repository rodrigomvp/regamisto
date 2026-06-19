import { describe, expect, it } from "vitest";
import { combineField, fieldValue, sampleProfile } from "./field.js";
import { christiansenCU, distributionUniformity } from "./uniformity.js";
import type { TransversalProfile } from "./types.js";

function profile(yMin: number, dy: number, depth: number[]): TransversalProfile {
  return { yMin, dy, depth: Float64Array.from(depth) };
}

describe("sampleProfile", () => {
  const p = profile(0, 1, [1, 2, 3]); // amostras em y = 0,1,2

  it("devolve o valor exato nas amostras", () => {
    expect(sampleProfile(p, 0)).toBeCloseTo(1, 9);
    expect(sampleProfile(p, 1)).toBeCloseTo(2, 9);
    expect(sampleProfile(p, 2)).toBeCloseTo(3, 9);
  });

  it("interpola linearmente entre amostras", () => {
    expect(sampleProfile(p, 0.5)).toBeCloseTo(1.5, 9);
    expect(sampleProfile(p, 1.25)).toBeCloseTo(2.25, 9);
  });

  it("faz rampa para 0 nas bordas e anula-se fora do suporte", () => {
    expect(sampleProfile(p, -0.5)).toBeCloseTo(0.5, 9); // rampa de 0 → 1
    expect(sampleProfile(p, 2.5)).toBeCloseTo(1.5, 9); // rampa de 3 → 0
    expect(sampleProfile(p, -1)).toBe(0);
    expect(sampleProfile(p, 3)).toBe(0);
    expect(sampleProfile(p, 10)).toBe(0);
  });
});

describe("fieldValue — sobreposição z(y) = Σ D(y − kS)", () => {
  it("sem sobreposição (largura do perfil = S) reproduz a passagem", () => {
    const p = profile(0, 1, [1, 2, 3]); // largura 3
    const S = 3;
    expect(fieldValue(p, S, 0)).toBeCloseTo(1, 9);
    expect(fieldValue(p, S, 1)).toBeCloseTo(2, 9);
    expect(fieldValue(p, S, 2)).toBeCloseTo(3, 9);
  });

  it("top-hat de largura 2S em tiras a S → campo uniforme (soma de 2 passagens)", () => {
    const p = profile(0, 1, [1, 1, 1, 1]); // largura 4
    const S = 2;
    for (const y of [0, 0.5, 1, 1.5]) {
      expect(fieldValue(p, S, y)).toBeCloseTo(2, 9);
    }
  });

  it("é periódico com período S", () => {
    const p = profile(0, 0.5, [1, 2, 3, 2, 1, 0.5]); // largura 3
    const S = 2;
    for (const y of [0.3, 0.7, 1.1, 1.9]) {
      expect(fieldValue(p, S, y + S)).toBeCloseTo(fieldValue(p, S, y), 9);
      expect(fieldValue(p, S, y - S)).toBeCloseTo(fieldValue(p, S, y), 9);
    }
  });

  it("rejeita espaçamento não positivo", () => {
    expect(() => fieldValue(profile(0, 1, [1]), 0, 0)).toThrow(RangeError);
  });

  it("conserva a água: integral de z sobre um período = integral de D", () => {
    const p = profile(0, 0.25, [0.5, 1, 2, 3, 2.5, 1.5, 1, 0.5]); // largura 2
    const S = 1.5;
    // ∫ z sobre [0,S) (campo periódico) deve igualar ∫ D (uma passagem)
    const N = 6000;
    const dy = S / N;
    let zInt = 0;
    for (let i = 0; i < N; i++) zInt += fieldValue(p, S, (i + 0.5) * dy) * dy;
    let dInt = 0;
    for (let i = 0; i < p.depth.length; i++) dInt += p.depth[i]! * p.dy;
    expect(zInt).toBeCloseTo(dInt, 4);
  });
});

describe("combineField", () => {
  it("amostra um período [0,S) com o número de pontos pedido", () => {
    const p = profile(0, 1, [1, 1, 1, 1]);
    const strip = combineField(p, 2, 4);
    expect(strip.z.length).toBe(4);
    expect(strip.dy).toBeCloseTo(0.5, 9);
    for (const v of strip.z) expect(v).toBeCloseTo(2, 9);
  });

  it("perfil que ladrilha perfeitamente (largura múltipla de S) → CU=100, DU=1", () => {
    const p = profile(0, 0.5, [1, 1, 1, 1, 1, 1, 1, 1]); // largura 4 = 2·S
    const strip = combineField(p, 2, 64);
    expect(christiansenCU(strip.z)).toBeCloseTo(100, 6);
    expect(distributionUniformity(strip.z)).toBeCloseTo(1, 6);
  });

  it("perfil triangular com sobreposição parcial → campo não uniforme (CU<100)", () => {
    const p = profile(0, 0.5, [0, 1, 2, 3, 2, 1, 0]); // pico ao centro, largura 3
    const strip = combineField(p, 4, 80); // S grande → faixas secas entre passagens
    expect(christiansenCU(strip.z)).toBeLessThan(100);
    expect(distributionUniformity(strip.z)).toBeLessThan(1);
  });
});
