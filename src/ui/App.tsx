import { useMemo, useState } from "react";
import { Controls } from "./Controls.js";
import { GridHeatmap } from "./Heatmap.js";
import { Legend } from "./Legend.js";
import { Metrics } from "./Metrics.js";
import { DEFAULT_MACHINE, simulate, type SimInputs } from "./pipeline.js";

const INITIAL: SimInputs = {
  windSpeed: 3,
  windFromDeg: 270, // Oeste
  spacing: 30,
  pressureBar: 8,
  marchSpeed: 60 / 3600, // 60 m/h
};

export function App() {
  const [inputs, setInputs] = useState<SimInputs>(INITIAL);

  // Recalcula toda a cadeia do motor ao vivo, a cada mexida nos sliders.
  const result = useMemo(() => simulate(inputs), [inputs]);

  const onChange = (patch: Partial<SimInputs>) =>
    setInputs((prev) => ({ ...prev, ...patch }));

  return (
    <div className="app">
      <header className="app-header">
        <h1>Footprint de rega por canhão</h1>
        <p className="sub">
          {DEFAULT_MACHINE.name} · vento dos sliders (sem meteorologia ainda)
        </p>
      </header>

      <div className="layout">
        <aside className="panel">
          <Controls inputs={inputs} onChange={onChange} />
        </aside>

        <main className="panel main-panel">
          <Metrics
            cu={result.cu}
            du={result.du}
            meanDepth={result.meanDepth}
            loss={result.loss}
          />
          <div className="map-row">
            <figure className="map-fig">
              <figcaption>
                Uma passagem isolada
                <small>diagnóstico da distorção pelo vento</small>
              </figcaption>
              <GridHeatmap
                grid={result.passGrid}
                colorMin={result.colorMin}
                colorMax={result.colorMax}
                windVec={result.windVec}
              />
            </figure>

            <figure className="map-fig">
              <figcaption>
                Campo (faixas a S = {Math.round(inputs.spacing)} m)
                <small>sobreposição das passagens</small>
              </figcaption>
              <GridHeatmap
                grid={result.fieldGrid}
                colorMin={result.colorMin}
                colorMax={result.colorMax}
                faixaSpacing={inputs.spacing}
              />
            </figure>

            <Legend />
          </div>
          <p className="axis-note">
            horizontal = x (marcha) · vertical = y (transversal às faixas) · mesma
            escala de cor nas duas vistas
          </p>
        </main>
      </div>
    </div>
  );
}
