import { useEffect, useRef } from "react";
import type { Grid, Vec2 } from "../model/index.js";
import { viridis } from "./colormap.js";

interface GridHeatmapProps {
  grid: Grid;
  /** Escala de cor partilhada (min–max dos dados atuais). */
  colorMin: number;
  colorMax: number;
  /** Se definido, desenha a seta do vento (vista da passagem isolada). */
  windVec?: Vec2;
  /** Se definido, desenha as linhas de centro das faixas a este espaçamento (m). */
  faixaSpacing?: number;
  width?: number;
  height?: number;
}

/**
 * Heatmap genérico de uma grelha 2D de deposição (mm). Eixo horizontal = x
 * (direção de marcha), vertical = y (transversal às faixas). As duas vistas
 * (passagem isolada e campo) usam este mesmo render e a mesma escala de cor.
 */
export function GridHeatmap({
  grid,
  colorMin,
  colorMax,
  windVec,
  faixaSpacing,
  width = 360,
  height = 360,
}: GridHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { cols, rows, data } = grid;
    const range = colorMax - colorMin || 1;

    const img = ctx.createImageData(width, height);
    const buf = img.data;
    for (let py = 0; py < height; py++) {
      const row = Math.min(rows - 1, Math.floor((py / height) * rows));
      for (let px = 0; px < width; px++) {
        const col = Math.min(cols - 1, Math.floor((px / width) * cols));
        const t = (data[row * cols + col]! - colorMin) / range;
        const [r, g, b] = viridis(t);
        const idx = (py * width + px) * 4;
        buf[idx] = r;
        buf[idx + 1] = g;
        buf[idx + 2] = b;
        buf[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Linhas de centro das faixas (vista do campo).
    if (faixaSpacing && faixaSpacing > 0) {
      const pxPerCell = height / rows;
      const stepPx = (faixaSpacing / grid.spec.cellSize) * pxPerCell;
      if (stepPx > 4) {
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        for (let py = height / 2; py < height; py += stepPx) {
          line(ctx, py, width);
        }
        for (let py = height / 2 - stepPx; py > 0; py -= stepPx) {
          line(ctx, py, width);
        }
        ctx.setLineDash([]);
      }
    }

    if (windVec) drawWindArrow(ctx, windVec);
  }, [grid, colorMin, colorMax, windVec, faixaSpacing, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} className="heatmap-canvas" />;
}

function line(ctx: CanvasRenderingContext2D, py: number, width: number) {
  ctx.beginPath();
  ctx.moveTo(0, py);
  ctx.lineTo(width, py);
  ctx.stroke();
}

/** Desenha uma seta a indicar para onde o vento vai (referencial do terreno). */
function drawWindArrow(ctx: CanvasRenderingContext2D, windVec: Vec2) {
  const speed = Math.hypot(windVec.x, windVec.y);
  const cx = 46;
  const cy = 46;
  ctx.save();
  ctx.fillStyle = "rgba(15,23,42,0.7)";
  ctx.fillRect(8, 8, 120, 70);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillText("vento →", 12, 22);
  if (speed > 1e-3) {
    // x = Este (direita), y = Norte; no ecrã y cresce para baixo → dy = −vy.
    const ux = windVec.x / speed;
    const uy = -windVec.y / speed;
    const len = 24;
    const ex = cx + ux * len;
    const ey = cy + uy * len;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - ux * len, cy - uy * len);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    const a = Math.atan2(uy, ux);
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - 8 * Math.cos(a - 0.4), ey - 8 * Math.sin(a - 0.4));
    ctx.lineTo(ex - 8 * Math.cos(a + 0.4), ey - 8 * Math.sin(a + 0.4));
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillText("calmo", 36, 50);
  }
  ctx.restore();
}
