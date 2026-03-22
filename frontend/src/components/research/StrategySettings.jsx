import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

// ── Input Renderers ──────────────────────────────────────────────────────────

const FIELD_CLS =
  "w-full rounded-xl border border-[#222222] bg-[#000000] px-3 py-2.5 text-sm text-white outline-none transition focus:border-white";

function NumberInput({ field, value, onChange }) {
  return (
    <input
      type="number"
      min={field.min}
      max={field.max}
      step={field.step ?? 1}
      value={value}
      onChange={(e) => onChange(field.key, field.type === "integer" ? parseInt(e.target.value, 10) : parseFloat(e.target.value))}
      className={FIELD_CLS}
    />
  );
}

function BooleanInput({ field, value, onChange }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <button
        type="button"
        onClick={() => onChange(field.key, !value)}
        className={`relative h-5 w-9 rounded-full transition ${value ? "bg-white" : "bg-[#333333]"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-black transition-transform ${
            value ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
      <span className="text-xs text-[#a0a0a0]">{value ? "Enabled" : "Disabled"}</span>
    </div>
  );
}

function DropdownInput({ field, value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(field.key, e.target.value)}
      className={FIELD_CLS}
    >
      {field.options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function StringInput({ field, value, onChange }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(field.key, e.target.value)}
      className={FIELD_CLS}
    />
  );
}

function FieldInput({ field, value, onChange }) {
  if (field.type === "boolean") return <BooleanInput field={field} value={value} onChange={onChange} />;
  if (field.type === "dropdown") return <DropdownInput field={field} value={value} onChange={onChange} />;
  if (field.type === "integer" || field.type === "float") return <NumberInput field={field} value={value} onChange={onChange} />;
  return <StringInput field={field} value={value} onChange={onChange} />;
}

// ── Section ──────────────────────────────────────────────────────────────────

function Section({ title, fields, settings, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-[#111111]"
      >
        <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#a0a0a0]">{title}</span>
        {open ? (
          <ChevronDown size={14} className="text-[#555555]" />
        ) : (
          <ChevronRight size={14} className="text-[#555555]" />
        )}
      </button>

      {open && (
        <div className="border-t border-[#1a1a1a] px-5 pb-5 pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => {
              // Boolean fields must NOT use <label> — it re-fires the button click causing double-toggle
              const Wrapper = field.type === "boolean" ? "div" : "label";
              return (
                <Wrapper key={field.key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#555555]">
                      {field.label}
                    </span>
                    {field.unit && (
                      <span className="text-[10px] text-[#444444]">{field.unit}</span>
                    )}
                  </div>
                  {field.description && (
                    <p className="text-[10px] text-[#3a3a3a]">{field.description}</p>
                  )}
                  <FieldInput field={field} value={settings[field.key]} onChange={onChange} />
                </Wrapper>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Schema ───────────────────────────────────────────────────────────────────

export const SETTINGS_SECTIONS = [
  {
    title: "Entry Rules",
    fields: [
      { key: "entryType", label: "Entry Type", type: "dropdown", options: [{ label: "Market", value: "market" }, { label: "Limit", value: "limit" }, { label: "Stop", value: "stop" }] },
      { key: "entryOrder", label: "Entry Order", type: "dropdown", options: [{ label: "Next Bar", value: "next_bar" }, { label: "Same Bar", value: "same_bar" }] },
      { key: "confirmBars", label: "Confirm Bars", type: "integer", min: 0, max: 20, description: "Bars to wait before confirming signal" },
    ],
  },
  {
    title: "Exit Rules",
    fields: [
      { key: "exitType", label: "Exit Type", type: "dropdown", options: [{ label: "Market", value: "market" }, { label: "Limit", value: "limit" }] },
      { key: "stopLoss", label: "Stop Loss %", type: "float", min: 0, step: 0.1, unit: "%" },
      { key: "takeProfit", label: "Take Profit %", type: "float", min: 0, step: 0.1, unit: "%" },
      { key: "trailingStop", label: "Trailing Stop %", type: "float", min: 0, step: 0.1, unit: "%" },
    ],
  },
  {
    title: "Risk Management",
    fields: [
      { key: "slippage", label: "Slippage", type: "integer", min: 0, max: 100, unit: "ticks", description: "Ticks per fill" },
      { key: "commission", label: "Commission", type: "float", min: 0, step: 0.001, unit: "%", description: "Percent of trade value" },
      { key: "pyramiding", label: "Pyramiding", type: "integer", min: 0, max: 10, description: "Max additional entries" },
      { key: "maxOpenPositions", label: "Max Open Positions", type: "integer", min: 1, max: 100 },
      { key: "dailyLossLimit", label: "Daily Loss Limit", type: "float", min: 0, step: 0.1, unit: "%", description: "Stop trading after this loss%" },
    ],
  },
  {
    title: "Market Realism",
    fields: [
      { key: "executionMode", label: "Execution Mode", type: "dropdown", options: [{ label: "Bar Close", value: "bar_close" }, { label: "Bar Open", value: "bar_open" }, { label: "OHLC", value: "ohlc" }] },
      { key: "barMagnifier", label: "Bar Magnifier", type: "boolean", description: "Use intra-bar resolution" },
      { key: "leverage", label: "Leverage", type: "integer", min: 1, max: 500, unit: "x" },
      { key: "margin", label: "Margin %", type: "float", min: 0, max: 100, step: 1, unit: "%" },
    ],
  },
  {
    title: "Validation",
    fields: [
      { key: "monteCarloSimulation", label: "Monte Carlo Simulation", type: "boolean", description: "Run randomized scenario analysis" },
      { key: "walkForwardOptimization", label: "Walk-Forward Optimization", type: "boolean", description: "Out-of-sample parameter testing" },
      { key: "adversarialShock", label: "Adversarial Shock", type: "boolean", description: "Apply stress scenarios to results" },
    ],
  },
];

// ── Panel ────────────────────────────────────────────────────────────────────

export default function StrategySettings({ settings, onSettingChange }) {
  return (
    <div className="space-y-2">
      {SETTINGS_SECTIONS.map((section) => (
        <Section
          key={section.title}
          title={section.title}
          fields={section.fields}
          settings={settings}
          onChange={onSettingChange}
        />
      ))}
    </div>
  );
}
