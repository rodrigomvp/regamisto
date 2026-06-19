import type { SimInputs } from "./pipeline.js";

interface SliderProps {
  label: string;
  /** Valor em SI (estado interno). */
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  /** Fator de conversão SI → unidade mostrada (ex.: 3600 para m/s → m/h). */
  displayScale?: number;
  /** Casas decimais no valor mostrado. */
  decimals?: number;
  onChange: (value: number) => void;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  displayScale = 1,
  decimals = 0,
  onChange,
}: SliderProps) {
  const shown = (value * displayScale).toFixed(decimals);
  return (
    <label className="slider">
      <span className="slider-head">
        <span className="slider-label">{label}</span>
        <span className="slider-value">
          {shown} {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

interface ControlsProps {
  inputs: SimInputs;
  onChange: (patch: Partial<SimInputs>) => void;
}

/** Painel de sliders. Graus só aqui na UI; tudo o resto em SI. */
export function Controls({ inputs, onChange }: ControlsProps) {
  return (
    <div className="controls">
      <h2>Setup</h2>
      <Slider
        label="Velocidade do vento"
        value={inputs.windSpeed}
        min={0}
        max={15}
        step={0.5}
        unit="m/s"
        decimals={1}
        onChange={(windSpeed) => onChange({ windSpeed })}
      />
      <Slider
        label="Direção do vento (de onde sopra)"
        value={inputs.windFromDeg}
        min={0}
        max={359}
        step={1}
        unit="°"
        onChange={(windFromDeg) => onChange({ windFromDeg })}
      />
      <Slider
        label="Espaçamento de faixa S"
        value={inputs.spacing}
        min={6}
        max={70}
        step={1}
        unit="m"
        onChange={(spacing) => onChange({ spacing })}
      />
      <Slider
        label="Pressão"
        value={inputs.pressureBar}
        min={2}
        max={10}
        step={0.1}
        unit="bar"
        decimals={1}
        onChange={(pressureBar) => onChange({ pressureBar })}
      />
      <Slider
        label="Velocidade de marcha u"
        value={inputs.marchSpeed}
        min={10 / 3600}
        max={200 / 3600}
        step={5 / 3600}
        unit="m/h"
        displayScale={3600}
        onChange={(marchSpeed) => onChange({ marchSpeed })}
      />
    </div>
  );
}
