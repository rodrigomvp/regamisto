import { viridisCss } from "./colormap.js";

/**
 * Legenda vertical da escala de cor, partilhada pelas duas vistas. A escala usa
 * o min–max dos dados atuais (relativa), logo mostra-se em % da deposição máxima
 * — a quantificação absoluta (mm) está no painel de métricas.
 */
export function Legend() {
  const stops = Array.from({ length: 11 }, (_, i) => {
    const t = i / 10;
    return `${viridisCss(t)} ${Math.round(t * 100)}%`;
  });
  const gradient = `linear-gradient(to top, ${stops.join(", ")})`;
  const ticks = [100, 75, 50, 25, 0];

  return (
    <div className="legend">
      <span className="legend-title">deposição</span>
      <div className="legend-body">
        <div className="legend-bar" style={{ background: gradient }} />
        <div className="legend-ticks">
          {ticks.map((t) => (
            <span key={t}>{t}%</span>
          ))}
        </div>
      </div>
    </div>
  );
}
