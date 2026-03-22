import { STRATEGY_CATALOG, STRATEGY_MAP } from "../../lib/strategyCatalog";

const FIELD_CLASSNAME = "w-full rounded-xl border border-[#222222] bg-[#111111] px-3 py-2.5 text-sm text-white outline-none transition focus:border-white";

export default function StrategyConfigurator({
  strategyId,
  parameters,
  onStrategyChange,
  onParameterChange,
}) {
  const strategy = STRATEGY_MAP[strategyId] || STRATEGY_CATALOG[0];

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#a0a0a0]">
          Strategy
        </label>
        <select
          value={strategy.id}
          onChange={(event) => onStrategyChange(event.target.value)}
          className={FIELD_CLASSNAME}
        >
          {STRATEGY_CATALOG.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {strategy.parameters.map((parameter) => (
          <label key={parameter.key} className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#a0a0a0]">
              {parameter.label}
            </span>

            {parameter.type === "select" ? (
              <select
                value={parameters?.[parameter.key] ?? parameter.defaultValue}
                onChange={(event) => onParameterChange(parameter.key, event.target.value)}
                className={FIELD_CLASSNAME}
              >
                {parameter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                min={parameter.min}
                step={parameter.step || 1}
                value={parameters?.[parameter.key] ?? parameter.defaultValue}
                onChange={(event) => onParameterChange(parameter.key, event.target.value)}
                className={FIELD_CLASSNAME}
              />
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
