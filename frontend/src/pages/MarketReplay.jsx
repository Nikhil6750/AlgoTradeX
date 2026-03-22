import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Database, PlayCircle, TrendingUp } from "lucide-react";

import ReplayChart from "../components/charts/ReplayChart";
import DatasetUploader from "../components/trading/DatasetUploader";
import ReplayControls from "../components/trading/ReplayControls";
import StrategyConfigurator from "../components/research/StrategyConfigurator";
import GlassPanel from "../components/ui/GlassPanel";
import PageTransition from "../components/ui/PageTransition";
import useReplayEngine from "../replay/useReplayEngine";
import { formatPercent, formatPlainPercent } from "../lib/formatters";
import { evaluateReplay, fetchDatasets } from "../lib/researchApi";
import { buildStrategyConfig, createDefaultParameters } from "../lib/strategyCatalog";

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"];

function computeReplayStats(trades) {
  const totalTrades = trades.length;
  const wins = trades.filter((trade) => Number(trade.pnl || 0) > 0).length;
  const profit = trades.reduce((sum, trade) => sum + Number(trade.pnl || 0), 0);

  let balance = 1;
  let peak = 1;
  let maxDrawdown = 0;
  trades.forEach((trade) => {
    balance *= 1 + Number(trade.pnl || 0);
    peak = Math.max(peak, balance);
    maxDrawdown = Math.min(maxDrawdown, balance / peak - 1);
  });

  return {
    totalTrades,
    winRate: totalTrades ? wins / totalTrades : 0,
    profit,
    maxDrawdown,
  };
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-[#222222] bg-[#111111] px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-[#a0a0a0]">{label}</p>
      <p className="mt-2 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

export default function MarketReplay() {
  const [datasets, setDatasets] = useState([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState("");
  const [timeframe, setTimeframe] = useState("1h");
  const [strategyId, setStrategyId] = useState("ma_crossover");
  const [parameters, setParameters] = useState(() => createDefaultParameters("ma_crossover"));
  const [loading, setLoading] = useState(false);
  const [replayData, setReplayData] = useState(null);
  const [loadedBacktestId, setLoadedBacktestId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    fetchDatasets()
      .then((items) => {
        if (!active) {
          return;
        }
        setDatasets(items);
        if (items[0]?.id) {
          setSelectedDatasetId((current) => current || items[0].id);
        }
      })
      .catch(() => {
        if (active) {
          setDatasets([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const candles = replayData?.candles || [];
  const {
    cursor,
    isPlaying,
    speed,
    setSpeed,
    play,
    pause,
    step,
    reset,
  } = useReplayEngine({
    candles,
    initialCursor: 0,
  });

  const currentTime = candles[cursor]?.time || 0;
  const visibleBuySignals = useMemo(
    () => (replayData?.buy_signals || []).filter((signal) => Number(signal.time || 0) <= currentTime),
    [currentTime, replayData?.buy_signals],
  );
  const visibleSellSignals = useMemo(
    () => (replayData?.sell_signals || []).filter((signal) => Number(signal.time || 0) <= currentTime),
    [currentTime, replayData?.sell_signals],
  );
  const visibleTrades = useMemo(
    () => (replayData?.trades || []).filter((trade) => Number(trade.exit_time || trade.entry_time || 0) <= currentTime),
    [currentTime, replayData?.trades],
  );
  const replayStats = useMemo(() => computeReplayStats(visibleTrades), [visibleTrades]);

  function handleStrategyChange(nextStrategyId) {
    setStrategyId(nextStrategyId);
    setParameters(createDefaultParameters(nextStrategyId));
  }

  function handleParameterChange(key, value) {
    setParameters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function refreshDatasets(preferredDatasetId = "") {
    const items = await fetchDatasets();
    setDatasets(items);
    setSelectedDatasetId(items.find((item) => item.id === preferredDatasetId)?.id || items[0]?.id || "");
  }

  async function handleLoadReplay() {
    if (!selectedDatasetId) {
      toast.error("Select or upload a dataset first.");
      return;
    }

    setLoading(true);
    pause();
    const loadingToast = toast.loading("Preparing replay...");

    try {
      const data = await evaluateReplay({
        symbol: selectedDatasetId,
        timeframe,
        config: buildStrategyConfig(strategyId, parameters),
        persist: true,
      });

      setReplayData(data);
      setLoadedBacktestId(data.backtest_id || null);
      toast.dismiss(loadingToast);
      toast.success("Replay loaded.");
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error(error?.message || "Replay preparation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageTransition className="min-h-screen bg-[#000000] px-4 py-16 text-white sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#a0a0a0]">Market Replay</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-white">Replay the market with persisted strategy context</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#a0a0a0]">
              All chart replay functionality lives here: dataset selection, strategy selection, playback controls, and candle-by-candle inspection.
            </p>
          </div>
          {loadedBacktestId && (
            <button
              type="button"
              onClick={() => navigate(`/results/${loadedBacktestId}`)}
              className="rounded-2xl border border-[#222222] bg-[#111111] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#161616]"
            >
              Open Stored Results
            </button>
          )}
        </div>

        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <GlassPanel className="border border-[#222222] bg-[#111111] p-6">
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#a0a0a0]">
                  <Database size={14} />
                  <span>Replay Controls</span>
                </div>
                <h2 className="mt-3 text-2xl font-black text-white">Dataset and strategy selection</h2>
              </div>

              <DatasetUploader
                appearance="monochrome"
                onUploadSuccess={(asset) => {
                  if (asset?.id) {
                    void refreshDatasets(asset.id);
                  }
                }}
              />

              <label className="block space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#a0a0a0]">
                  Dataset Selection
                </span>
                <select
                  value={selectedDatasetId}
                  onChange={(event) => setSelectedDatasetId(event.target.value)}
                  className="w-full rounded-xl border border-[#222222] bg-[#111111] px-3 py-2.5 text-sm text-white outline-none transition focus:border-white"
                >
                  <option value="">Select a dataset</option>
                  {datasets.map((dataset) => (
                    <option key={dataset.id} value={dataset.id}>
                      {dataset.filename}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#a0a0a0]">
                  Replay Timeframe
                </span>
                <select
                  value={timeframe}
                  onChange={(event) => setTimeframe(event.target.value)}
                  className="w-full rounded-xl border border-[#222222] bg-[#111111] px-3 py-2.5 text-sm text-white outline-none transition focus:border-white"
                >
                  {TIMEFRAMES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <StrategyConfigurator
                strategyId={strategyId}
                parameters={parameters}
                onStrategyChange={handleStrategyChange}
                onParameterChange={handleParameterChange}
              />

              <button
                type="button"
                onClick={handleLoadReplay}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#222222] bg-[#111111] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#161616] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <PlayCircle size={16} />
                {loading ? "Loading Replay..." : "Load Replay"}
              </button>
            </div>
          </GlassPanel>

          <div className="space-y-6">
            <ReplayControls
              isPlaying={isPlaying}
              speed={speed}
              cursor={cursor}
              totalCandles={candles.length}
              canStep={candles.length > 0 && cursor < candles.length - 1}
              onPlay={play}
              onPause={pause}
              onStep={step}
              onReset={() => reset(0)}
              onSpeedChange={setSpeed}
            />

            <div className="grid gap-4 md:grid-cols-4">
              <Stat label="Visible Trades" value={replayStats.totalTrades} />
              <Stat label="Win Rate" value={formatPlainPercent(replayStats.winRate)} />
              <Stat label="Profit" value={formatPercent(replayStats.profit)} />
              <Stat label="Drawdown" value={formatPercent(replayStats.maxDrawdown)} />
            </div>

            <GlassPanel className="border border-[#222222] bg-[#111111] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-[#a0a0a0]">Replay Chart</p>
                  <h2 className="mt-2 text-2xl font-black text-white">Candle-by-candle playback</h2>
                </div>
                {loadedBacktestId && (
                  <div className="flex items-center gap-2 rounded-full border border-[#222222] bg-[#111111] px-3 py-1.5 text-xs text-[#a0a0a0]">
                    <TrendingUp size={14} />
                    Backtest #{loadedBacktestId}
                  </div>
                )}
              </div>

              <div className="h-[620px] overflow-hidden rounded-3xl border border-[#222222] bg-[#000000]">
                {candles.length > 0 ? (
                  <ReplayChart
                    datasetKey={`${selectedDatasetId}-${timeframe}-${loadedBacktestId || "preview"}`}
                    candles={candles}
                    cursor={cursor}
                    buySignals={visibleBuySignals}
                    sellSignals={visibleSellSignals}
                    completedTrades={visibleTrades}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-8 text-center text-sm text-[#a0a0a0]">
                    Load a dataset and strategy to start replaying the chart.
                  </div>
                )}
              </div>
            </GlassPanel>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
