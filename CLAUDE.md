# CLAUDE.md — Simulador de footprint de rega por canhão

> Ficheiro de contexto do projeto. Lê isto primeiro: descreve o que se está a
> construir, porquê, o modelo matemático, as convenções de código e o estado
> atual. A referência matemática completa está em `docs/modelo_footprint_rega.pdf`.

---

## 1. O que é

Ferramenta de **apoio à decisão de rega** para máquinas de canhão / carretel
(*hard-hose travelers* / *big guns*). Dado o vento e as características da máquina
e do campo, o software:

1. prevê como o vento **distorce o footprint** (zona molhada) do canhão;
2. estima a **uniformidade** da rega (métricas CU e DU) e mostra as faixas
   secas/encharcadas;
3. recomenda **quando regar** e **com que setup** (pressão, espaçamento de faixa,
   janela horária face à previsão de vento).

O primeiro artefacto é um **simulador interativo** (web) com mapa de calor da
aplicação de água e CU/DU a recalcular ao vivo conforme os sliders.

## 2. Objetivo e contexto

- **Finalidade primária:** peça de **portfólio / currículo** — demonstrar
  modelação física, métodos numéricos, calibração com dados reais e visualização.
  Monetização é desejável mas secundária.
- **Vantagem do projeto:** há acesso a **campos-piloto de milho** (região do
  Mondego) para validar o modelo com medições reais (grelha de baldes / *catch-cans*).
- **Decisão de âmbito fundamental:** o produto **aconselha**, não **atua**. Não
  controla a máquina em tempo real — isso exigiria hardware, levanta questões de
  patente e está fora de escopo. Tudo é software de decisão.

## 3. Modelo (resumo — detalhe no PDF)

Cadeia de cálculo em camadas. Os símbolos estão no glossário (secção 8).

| # | Camada | Expressão central |
|---|--------|-------------------|
| 1 | Velocidade do jato | `v0 = Cv·√(2P/ρ) ≈ 14.1·√(P_bar)` m/s |
| 1 | Raio em ar parado | `R0 ≈ c·√P` — **vem da tabela do fabricante**, não da balística |
| 2 | Deriva pelo vento | `Δ(r) = κ·(r/R0)^p · w·ŵ` |
| 3 | Densidade radial | `g(r) ∝ (r/R0)^m·(1−r/R0)^n`, `∫g dr = 1`, pico em `m/(m+n)` |
| 3 | Intensidade | `I(r) = Q·g(r) / (Φ·r)`  ← o fator `1/r` é físico, não esquecer |
| 3 | Perfil de passagem | `D(y) = (1/u)·∫ I(√(x²+y²)) dx` |
| 4 | Perdas (WDEL) | `perda(w) = clamp(L0 + L1·w, 0, 0.4)` |
| 5 | Campo | `z(y) = Σ_k D_ef(y − k·S)` |
| 5 | Uniformidade | `CU = 100·(1 − Σ|z_i−z̄|/Σz_i)` · `DU = z̄(¼ mais seco)/z̄` |

**Parâmetros calibráveis:** `θ = (κ, p, L0, L1)`. A forma do canhão `(m, n)`
fixa-se da ficha do fabricante. *Priors* de arranque: `p≈0.5`, `κ≈2–3`,
`L0≈0.10`, `L1≈0.03`. Calibração = minimizar `SSE(θ)` contra as medições de balde.

**Implementação = método de partículas.** Não se resolvem os integrais em forma
fechada: amostram-se M pontos no padrão de ar parado (r ~ g(r), θ uniforme no
setor Φ), desloca-se cada um por `Δ(r)`, acumulam-se numa grelha → mapa da
passagem. O perfil `D(y)` e o fator `1/r` emergem da densidade de partículas.

## 4. Stack e arquitetura

- **Frontend:** React + TypeScript (Vite). É o coração do MVP.
- **Motor do modelo:** TypeScript puro, em **funções puras e testáveis**
  (`src/model/`), independentes do React — para se poderem calibrar e testar
  isoladamente, e reusar fora da UI.
- **Render do mapa de calor:** `<canvas>` 2D (grelha de deposição). Sliders e
  leituras em React. CU/DU recalculados em memória, sem backend.
- **Meteorologia:** API **Open-Meteo** (sem chave, grátis) — velocidade,
  direção e rajadas de vento por lat/lon, previsão horária. IPMA como alternativa.
- **Backend:** **nenhum na v1.** Perfis de máquina e configs de campo ficam em
  JSON local / `localStorage`. Introduzir backend (C#/SQL ou Supabase) só quando
  houver multi-utilizador ou persistência partilhada — fora do MVP.

### Estrutura sugerida
```
src/
  model/            # motor — TypeScript puro, sem React
    jet.ts          # v0, R0 a partir de pressão/bico
    radial.ts       # g(r) Beta, I(r)
    drift.ts        # Δ(r) — deriva pelo vento
    deposit.ts      # método de partículas → grelha
    field.ts        # sobreposição de faixas, z(y)
    uniformity.ts   # CU, DU
    calibrate.ts    # SSE + otimizador (Nelder-Mead)
    types.ts        # MachineProfile, FieldConfig, Wind, Grid
  weather/          # cliente Open-Meteo
  ui/               # componentes React: sliders, heatmap, leituras
  data/             # perfis de canhão (tabelas do fabricante) em JSON
docs/
  modelo_footprint_rega.pdf
```

## 5. Convenções

- **Unidades (SI internamente):** distâncias em **metros**, velocidades em
  **m/s**, profundidade de água em **mm**, ângulos em **radianos** no motor
  (graus só na UI). Pressão entra em **bar**, converte-se para Pa (`×1e5`) na
  física. Caudal `Q` em **m³/s** internamente (converter de m³/h ou L/min na borda).
- **Vento — convenção crítica:** a direção meteorológica é a direção **de onde**
  o vento sopra. O vetor de deriva `ŵ` aponta para onde o vento **vai** =
  `direção_de + 180°`. Definir isto num único sítio (`weather/`) e nunca duplicar.
  Rumos (bússola): graus a partir do Norte, sentido horário.
- **Funções puras:** o motor não tem estado nem efeitos secundários; recebe
  inputs, devolve grelhas/números. Facilita testes e calibração.
- **Arredondar tudo o que vai para o ecrã** (`toFixed`/`Math.round`) — floats
  deixam artefactos. Nunca arredondar nos cálculos intermédios.
- **TypeScript estrito** (`strict: true`), sem `any`. Tipos de domínio em
  `model/types.ts`.
- **Testes:** cada função do motor com teste de sanidade. O teste-mestre é a
  **conservação de água** (volume depositado = volume aplicado × (1−perda)).

## 6. Âmbito do MVP

**Dentro:** motor de deposição 2D, mapa de calor, CU/DU ao vivo, sliders de vento
e espaçamento, perfis de canhão com *priors*, integração de vento Open-Meteo,
semáforo de janela de rega.

**Fora (de propósito):** controlo/atuação na máquina, sensores/telemetria,
multi-utilizador, autenticação, faturação, app nativa, terreno com declive,
modelação explícita de tamanhos de gota (é a v2).

## 7. Roadmap

1. **Motor + heatmap** — `model/` + canvas, com inputs manuais e *priors*. ← começar aqui
2. **Sliders + CU/DU ao vivo** — vento (módulo/direção), espaçamento `S`, pressão.
3. **Integração Open-Meteo** — vento automático por localização + janela horária.
4. **Ferramenta de calibração** — importar medições de balde, ajustar `θ` por SSE.
5. **Validação de campo** — sessões reais, afinar `κ, p, L0, L1`, registar erro.

## 8. Glossário de símbolos

`P` pressão · `v0` velocidade de saída · `R0` raio em ar parado · `Q` caudal ·
`Φ` setor angular regado · `r,θ` coordenadas polares ao canhão ·
`g(r)` densidade radial · `m,n` forma do perfil (Beta) · `I(r)` intensidade ·
`u` velocidade de marcha · `D(y)` profundidade transversal numa passagem ·
`w,ŵ` módulo e direção do vento · `Δ(r)` deriva · `κ,p` params de deriva ·
`L0,L1` params de perda · `S` espaçamento entre faixas · `z(y)` aplicação no campo ·
`CU` uniformidade de Christiansen · `DU` *distribution uniformity* · `θ` vetor a calibrar.

## 9. Referências

- `docs/modelo_footprint_rega.pdf` — dedução matemática completa.
- Tabelas de desempenho dos canhões (ex.: Nelson Big Gun) → `src/data/`.
- Open-Meteo — `https://open-meteo.com` (vento horário, sem chave).
- CU (Christiansen) e DU (*low-quarter*) — métricas-padrão de uniformidade de rega.
