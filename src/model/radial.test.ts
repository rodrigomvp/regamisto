import { describe, expect, it } from "vitest";
import { mulberry32 } from "./deposit.js";
import {
  betaFunction,
  intensity,
  logGamma,
  makeRadialSampler,
  radialDensity,
  radialPeak,
} from "./radial.js";

describe("logGamma / betaFunction", () => {
  it("reproduz fatoriais: Γ(n+1) = n!", () => {
    expect(Math.exp(logGamma(5))).toBeCloseTo(24, 6); // 4!
    expect(Math.exp(logGamma(6))).toBeCloseTo(120, 5); // 5!
  });

  it("Γ(1/2) = √π", () => {
    expect(Math.exp(logGamma(0.5))).toBeCloseTo(Math.sqrt(Math.PI), 9);
  });

  it("B(m+1, n+1) bate certo com ∫₀¹ t^m(1−t)^n dt (m=2,n=1 → 1/12)", () => {
    expect(betaFunction(3, 2)).toBeCloseTo(1 / 12, 9);
  });
});

describe("radialDensity", () => {
  const R0 = 50;
  const m = 2;
  const n = 1;

  it("integra para 1 sobre [0, R0]", () => {
    const N = 200000;
    const dr = R0 / N;
    let integral = 0;
    for (let i = 0; i < N; i++) {
      const r = (i + 0.5) * dr;
      integral += radialDensity(r, R0, m, n) * dr;
    }
    expect(integral).toBeCloseTo(1, 3);
  });

  it("anula-se fora de (0, R0)", () => {
    expect(radialDensity(0, R0, m, n)).toBe(0);
    expect(radialDensity(R0, R0, m, n)).toBe(0);
    expect(radialDensity(-5, R0, m, n)).toBe(0);
    expect(radialDensity(R0 + 5, R0, m, n)).toBe(0);
  });

  it("tem o máximo no raio do pico", () => {
    const peak = radialPeak(R0, m, n);
    const gPeak = radialDensity(peak, R0, m, n);
    expect(radialDensity(peak - 5, R0, m, n)).toBeLessThan(gPeak);
    expect(radialDensity(peak + 5, R0, m, n)).toBeLessThan(gPeak);
  });
});

describe("radialPeak", () => {
  it("aplica r_pico = R0·m/(m+n) — terço exterior para m=2,n=1", () => {
    expect(radialPeak(60, 2, 1)).toBeCloseTo(40, 9); // 60·2/3
  });
});

describe("intensity", () => {
  const R0 = 50;
  const m = 2;
  const n = 1;
  const Q = 0.02;
  const sector = Math.PI;

  it("contém o fator físico 1/r: I(r)·r/g(r) = Q/Φ constante", () => {
    const expected = Q / sector;
    for (const r of [5, 15, 30, 45]) {
      const ratio = (intensity(r, Q, sector, R0, m, n) * r) / radialDensity(r, R0, m, n);
      expect(ratio).toBeCloseTo(expected, 9);
    }
  });

  it("anula-se fora de (0, R0)", () => {
    expect(intensity(0, Q, sector, R0, m, n)).toBe(0);
    expect(intensity(R0, Q, sector, R0, m, n)).toBe(0);
  });
});

describe("makeRadialSampler", () => {
  it("reproduz a média analítica R0·(m+1)/(m+n+2)", () => {
    const R0 = 50;
    const m = 2;
    const n = 1;
    const sampler = makeRadialSampler(R0, m, n);
    const rng = mulberry32(42);
    const N = 200000;
    let sum = 0;
    for (let i = 0; i < N; i++) sum += sampler(rng());
    const mean = sum / N;
    const expected = (R0 * (m + 1)) / (m + n + 2); // Beta(m+1,n+1) → R0·(m+1)/(m+n+2)
    expect(mean).toBeCloseTo(expected, 0);
    expect(mean / expected).toBeCloseTo(1, 1);
  });

  it("mantém todas as amostras dentro de [0, R0]", () => {
    const R0 = 30;
    const sampler = makeRadialSampler(R0, 2, 1);
    const rng = mulberry32(7);
    for (let i = 0; i < 5000; i++) {
      const r = sampler(rng());
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(R0);
    }
  });
});
