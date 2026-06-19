import { describe, expect, it } from "vitest";
import { christiansenCU, distributionUniformity, mean, uniformity } from "./uniformity.js";

describe("mean", () => {
  it("calcula a média", () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
  });
  it("vetor vazio → 0", () => {
    expect(mean([])).toBe(0);
  });
});

describe("christiansenCU", () => {
  it("campo perfeitamente uniforme → CU = 100", () => {
    expect(christiansenCU([10, 10, 10, 10])).toBe(100);
    expect(christiansenCU(Float64Array.from([5, 5, 5]))).toBe(100);
  });

  it("caso sintético [1,2,3,4] → CU = 60 (à mão)", () => {
    // z̄ = 2.5; Σ|z−z̄| = 1.5+0.5+0.5+1.5 = 4; Σz = 10; CU = 100·(1−4/10) = 60
    expect(christiansenCU([1, 2, 3, 4])).toBeCloseTo(60, 9);
  });

  it("campo todo seco (Σz=0) → 0 (indefinido)", () => {
    expect(christiansenCU([0, 0, 0])).toBe(0);
  });

  it("aceita Float64Array", () => {
    expect(christiansenCU(Float64Array.from([1, 2, 3, 4]))).toBeCloseTo(60, 9);
  });
});

describe("distributionUniformity", () => {
  it("campo perfeitamente uniforme → DU = 1", () => {
    expect(distributionUniformity([10, 10, 10, 10])).toBe(1);
  });

  it("caso sintético [1,2,3,4] → DU = 0.4 (à mão)", () => {
    // quarto mais seco = round(4/4)=1 valor → {1}; média = 1; z̄ = 2.5; DU = 0.4
    expect(distributionUniformity([1, 2, 3, 4])).toBeCloseTo(0.4, 9);
  });

  it("caso sintético n=8 → média do quarto mais seco / média global", () => {
    // valores 1..8: z̄ = 4.5; quarto = round(8/4)=2 → {1,2}; média = 1.5; DU = 1.5/4.5 = 1/3
    expect(distributionUniformity([1, 2, 3, 4, 5, 6, 7, 8])).toBeCloseTo(1 / 3, 9);
  });

  it("campo todo seco → 0", () => {
    expect(distributionUniformity([0, 0, 0, 0])).toBe(0);
  });
});

describe("uniformity (resumo)", () => {
  it("agrega média, CU e DU coerentes", () => {
    const s = uniformity([1, 2, 3, 4]);
    expect(s.mean).toBeCloseTo(2.5, 9);
    expect(s.cu).toBeCloseTo(60, 9);
    expect(s.du).toBeCloseTo(0.4, 9);
  });

  it("uniforme → CU=100, DU=1", () => {
    const s = uniformity([7, 7, 7, 7, 7]);
    expect(s.cu).toBe(100);
    expect(s.du).toBe(1);
  });
});
