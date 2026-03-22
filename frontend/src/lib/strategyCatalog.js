export const STRATEGY_CATALOG = [
  {
    id: "ma_crossover",
    label: "Moving Average Crossover",
    description: "Trend-following crossover with configurable fast and slow moving averages.",
    parameters: [
      { key: "fast_period", label: "Fast Period", type: "number", min: 1, step: 1, defaultValue: 10 },
      { key: "slow_period", label: "Slow Period", type: "number", min: 2, step: 1, defaultValue: 30 },
      {
        key: "ma_type",
        label: "MA Type",
        type: "select",
        defaultValue: "EMA",
        options: [
          { label: "EMA", value: "EMA" },
          { label: "SMA", value: "SMA" },
        ],
      },
    ],
  },
  {
    id: "rsi_reversal",
    label: "RSI Reversal",
    description: "Contrarian entries on oversold and overbought RSI extremes.",
    parameters: [
      { key: "rsi_length", label: "RSI Length", type: "number", min: 1, step: 1, defaultValue: 14 },
      { key: "overbought", label: "Overbought", type: "number", min: 50, step: 1, defaultValue: 70 },
      { key: "oversold", label: "Oversold", type: "number", min: 1, step: 1, defaultValue: 30 },
    ],
  },
];

export const STRATEGY_MAP = Object.fromEntries(
  STRATEGY_CATALOG.map((strategy) => [strategy.id, strategy]),
);

export function createDefaultParameters(strategyId) {
  const strategy = STRATEGY_MAP[strategyId] || STRATEGY_CATALOG[0];
  return Object.fromEntries(
    strategy.parameters.map((parameter) => [parameter.key, parameter.defaultValue]),
  );
}

export function normalizeParameters(strategyId, parameters) {
  const strategy = STRATEGY_MAP[strategyId] || STRATEGY_CATALOG[0];
  const nextParameters = {};

  strategy.parameters.forEach((parameter) => {
    const value = parameters?.[parameter.key];
    if (parameter.type === "number") {
      const numeric = Number(value);
      nextParameters[parameter.key] = Number.isFinite(numeric)
        ? numeric
        : Number(parameter.defaultValue);
      return;
    }

    nextParameters[parameter.key] = value ?? parameter.defaultValue;
  });

  return nextParameters;
}

export function buildStrategyConfig(strategyId, parameters, settings = {}) {
  return {
    mode: "template",
    strategy: strategyId,
    parameters: normalizeParameters(strategyId, parameters),
    settings,
  };
}

export function createDefaultSettings() {
  return {
    // Entry Rules
    entryType: "market",
    entryOrder: "next_bar",
    confirmBars: 0,

    // Exit Rules
    exitType: "market",
    stopLoss: 2.0,
    takeProfit: 4.0,
    trailingStop: 0,

    // Risk Management
    slippage: 1,
    commission: 0.1,
    pyramiding: 0,
    maxOpenPositions: 1,
    dailyLossLimit: 5.0,

    // Market Realism
    executionMode: "bar_close",
    barMagnifier: false,
    leverage: 1,
    margin: 100,

    // Validation
    monteCarloSimulation: false,
    walkForwardOptimization: false,
    adversarialShock: false,
  };
}

