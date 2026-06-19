/**
 * Tipos de domínio do motor de footprint de rega.
 *
 * Convenções (ver CLAUDE.md §5): SI internamente — distâncias em metros,
 * velocidades em m/s, profundidade de água em mm, ângulos em radianos.
 * A pressão entra em bar e converte-se para Pa na física.
 */

/** Vetor 2D no plano do terreno (metros, ou m/s no caso do vento). */
export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Vento meteorológico.
 *
 * Convenção crítica (CLAUDE.md §5): `fromDeg` é a direção DE ONDE o vento
 * sopra, em graus de bússola (a partir do Norte, sentido horário). O vetor de
 * deriva aponta para onde o vento VAI = `fromDeg + 180°`. A conversão para
 * vetor descendente (downwind) vive em `weather/`, NUNCA aqui no motor — o
 * motor consome diretamente um `Vec2` já no referencial do terreno.
 */
export interface Wind {
  /** Módulo do vento, m/s. */
  speed: number;
  /** Direção de onde sopra, graus de bússola. */
  fromDeg: number;
}

/**
 * Perfil de um canhão — propriedades fixas da ficha do fabricante.
 * A forma radial `(m, n)` fixa-se daqui; só `(κ, p, L0, L1)` se calibram.
 */
export interface MachineProfile {
  name: string;
  /** Coeficiente `c` em `R0 = c·√P` (m por √bar), da tabela do fabricante. */
  rangeCoeff: number;
  /** Caudal `Q`, m³/s (converter de m³/h ou L/min na borda da aplicação). */
  flow: number;
  /** Setor angular regado `Φ`, radianos. */
  sector: number;
  /** Expoente `m` da forma radial Beta. */
  m: number;
  /** Expoente `n` da forma radial Beta. */
  n: number;
}

/** Configuração do campo / setup de rega (entrada do utilizador). */
export interface FieldConfig {
  /** Pressão de operação `P`, bar. */
  pressureBar: number;
  /** Espaçamento entre faixas `S`, metros. */
  spacing: number;
  /** Velocidade de marcha `u`, m/s. */
  marchSpeed: number;
}

/** Parâmetros calibráveis da deriva pelo vento (camada 2). */
export interface DriftParams {
  /** `κ` — deriva (m) na ponta do padrão por cada m/s de vento. */
  kappa: number;
  /** `p` — expoente do tempo de voo efetivo (prior ≈ 0.5). */
  p: number;
}

/** Parâmetros calibráveis das perdas por vento / WDEL (camada 4). */
export interface LossParams {
  /** `L0` — perda base (prior ≈ 0.10). */
  L0: number;
  /** `L1` — sensibilidade ao vento (prior ≈ 0.03 por m/s). */
  L1: number;
}

/** Limites e resolução de uma grelha de deposição, em metros. */
export interface GridSpec {
  /** Aresta de cada célula quadrada, metros. */
  cellSize: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** Grelha de deposição. `data` é row-major: índice = `row * cols + col`. */
export interface Grid {
  spec: GridSpec;
  cols: number;
  rows: number;
  /** Valores por célula (profundidade em mm na saída de `deposit`). */
  data: Float64Array;
}

/**
 * Perfil transversal de uma passagem `D(y)`: profundidade aplicada (mm) ao longo
 * da distância perpendicular `y` à linha de marcha, amostrada uniformemente.
 *
 * Suporte: `[yMin, yMin + depth.length·dy)`. Fora do suporte `D(y) = 0`.
 */
export interface TransversalProfile {
  /** Posição `y` da primeira amostra, m. */
  yMin: number;
  /** Passo de amostragem em `y`, m. */
  dy: number;
  /** Profundidade `D(y)` em cada amostra, mm. */
  depth: Float64Array;
}
