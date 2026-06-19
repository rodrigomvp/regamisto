interface MetricsProps {
  cu: number;
  du: number;
  meanDepth: number;
  loss: number;
}

/** Cor de semáforo a partir de limiares (verde / âmbar / vermelho). */
function light(value: number, good: number, ok: number): string {
  if (value >= good) return "#16a34a";
  if (value >= ok) return "#d97706";
  return "#dc2626";
}

/** Painel de destaque com CU, DU e leituras de apoio à decisão. */
export function Metrics({ cu, du, meanDepth, loss }: MetricsProps) {
  return (
    <div className="metrics">
      <div className="metric big" style={{ borderColor: light(cu, 84, 70) }}>
        <span className="metric-label">CU (Christiansen)</span>
        <span className="metric-value" style={{ color: light(cu, 84, 70) }}>
          {cu.toFixed(1)}
          <small>%</small>
        </span>
      </div>
      <div className="metric big" style={{ borderColor: light(du, 0.8, 0.65) }}>
        <span className="metric-label">DU (low-quarter)</span>
        <span className="metric-value" style={{ color: light(du, 0.8, 0.65) }}>
          {du.toFixed(2)}
        </span>
      </div>
      <div className="metric">
        <span className="metric-label">Aplicação média</span>
        <span className="metric-value sm">
          {meanDepth.toFixed(1)}
          <small>mm</small>
        </span>
      </div>
      <div className="metric">
        <span className="metric-label">Perda (WDEL)</span>
        <span className="metric-value sm">
          {(loss * 100).toFixed(0)}
          <small>%</small>
        </span>
      </div>
    </div>
  );
}
