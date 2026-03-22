import { useState, useEffect, useRef, useMemo } from "react";
import toast from "react-hot-toast";
import { Radar, TrendingUp, TrendingDown, Play, BarChart2, Settings2 } from "lucide-react";

import DatasetUploader from "../components/trading/DatasetUploader";
import StrategyConfigurator from "../components/research/StrategyConfigurator";
import StrategySettings from "../components/research/StrategySettings";
import ReplayControls from "../components/research/ReplayControls";
import GlassPanel from "../components/ui/GlassPanel";
import PageTransition from "../components/ui/PageTransition";
import StrategyChart from "../components/StrategyChart";
import { buildStrategyConfig, createDefaultParameters, createDefaultSettings } from "../lib/strategyCatalog";
import { runStrategyEvaluation } from "../lib/researchApi";
import { formatTimestamp } from "../lib/formatters";
import { api } from "../lib/api";

const TIMEFRAMES = ["5m", "15m", "30m", "1h", "4h"];

function SetupCard({ setup, isActive, onClick }) {
  const isBuy = String(setup.type || "").toUpperCase() === "BUY";
  const displayTime = setup.time
    ? new Date(setup.time * 1000).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : setup.timestamp
    ? formatTimestamp(setup.timestamp)
    : "—";

  const confidence = setup.confidence != null ? Math.round(setup.confidence * 100) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
        isActive
          ? "border-white bg-[#151515]"
          : "border-[#222222] bg-[#111111] hover:bg-[#161616]"
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`flex items-center gap-1.5 text-sm font-bold ${
            isBuy ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {isBuy ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {String(setup.type || "").toUpperCase()}
        </span>
        <div className="flex items-center gap-2">
          {setup.sentiment && (
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                setup.sentiment === "Bullish"
                  ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/5"
                  : setup.sentiment === "Bearish"
                  ? "text-rose-400 border-rose-400/20 bg-rose-400/5"
                  : "text-[#555555] border-[#333333] bg-[#111111]"
              }`}
            >
              {setup.sentiment}
            </span>
          )}
          {confidence != null ? (
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                confidence >= 60
                  ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/5"
                  : confidence >= 40
                  ? "text-amber-400 border-amber-400/20 bg-amber-400/5"
                  : "text-rose-400 border-rose-400/20 bg-rose-400/5"
              }`}
            >
              {confidence}%
            </span>
          ) : (
            <span className="text-xs text-[#555555]">#{setup.index ?? "—"}</span>
          )}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.1em] text-[#555555]">Time</p>
          <p className="mt-0.5 text-[11px] text-[#a0a0a0]">{displayTime}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.1em] text-[#555555]">Price</p>
          <p className="mt-0.5 text-[11px] font-semibold text-white">
            {Number(setup.price || 0).toFixed(4)}
          </p>
        </div>
      </div>
    </button>
  );
}

export default function StrategyLab() {
  const [activeTab, setActiveTab] = useState("run");
  const [dataset, setDataset] = useState(null);
  const [timeframe, setTimeframe] = useState("5m");
  const [strategyId, setStrategyId] = useState("ma_crossover");
  const [parameters, setParameters] = useState(() => createDefaultParameters("ma_crossover"));
  
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [selectedSetup, setSelectedSetup] = useState(null);
  const [settings, setSettings] = useState(() => createDefaultSettings());
  const [selectedDate, setSelectedDate] = useState("");

  // Backend connection check
  const [isBackendOnline, setIsBackendOnline] = useState(true);

  useEffect(() => {
    let mounted = true;
    const checkBackend = async () => {
      try {
        await api.ping();
        if (mounted) setIsBackendOnline(true);
      } catch {
        if (mounted) setIsBackendOnline(false);
      }
    };
    checkBackend();
    const interval = setInterval(checkBackend, 5000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  // Replay mode
  const [replayMode, setReplayMode] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(250); // ms per step
  const replayTimerRef = useRef(null);

  // Advance replay on play
  useEffect(() => {
    if (!replayPlaying) { clearInterval(replayTimerRef.current); return; }
    const total = Array.isArray(results?.candles) ? results.candles.length : 0;
    replayTimerRef.current = setInterval(() => {
      setReplayIndex((i) => {
        if (i >= total) { setReplayPlaying(false); return i; }
        return i + 1;
      });
    }, replaySpeed);
    return () => clearInterval(replayTimerRef.current);
  }, [replayPlaying, replaySpeed, results]);

  // Reset replay when new results arrive
  useEffect(() => {
    if (results) {
      setReplayMode(false);
      setReplayPlaying(false);
      setReplayIndex(0);
    }
  }, [results]);

  function handleSettingChange(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

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

  async function handleRunStrategy() {
    if (!dataset || !dataset.candles || dataset.candles.length === 0) {
      toast.error("Upload a CSV dataset first.");
      return;
    }

    setLoading(true);
    setResults(null);
    setError(null);
    const loadingToast = toast.loading("Running strategy...");

    try {
      const response = await runStrategyEvaluation({
        symbol: dataset.name || "custom_upload",
        timeframe,
        candles: dataset.candles,
        config: buildStrategyConfig(strategyId, parameters, settings),
      });

      console.log("Strategy Results:", response);
      toast.dismiss(loadingToast);
      toast.success("Strategy run complete.");
      
      setResults(response);
      setSelectedSetup(null);
      setActiveTab("results");
    } catch (err) {
      const errMsg = err?.response?.data?.detail || err.message || "";
      console.error("Strategy execution error:", err);
      toast.dismiss(loadingToast);
      
      if (errMsg.includes("Dataset too small")) {
        setError(`Dataset too small. Please upload a larger CSV dataset.`);
        toast.error(`Dataset too small. Please upload a larger CSV dataset.`);
      } else {
        setError("Strategy execution failed");
        toast.error("Strategy execution failed");
      }
    } finally {
      setLoading(false);
    }
  }

  const rawSetups = results?.trade_setups || [];
  const tradeSetups = useMemo(() => {
    const setups = Array.isArray(rawSetups) ? rawSetups : [];
    if (!selectedDate) return setups;
    return setups.filter((s) => {
      const setupDate = new Date(s.time * 1000).toISOString().split("T")[0];
      return setupDate === selectedDate;
    });
  }, [rawSetups, selectedDate]);
  
  const metrics = results?.metrics || {};
  const allCandles = results?.candles || [];
  
  // Safe Array Normalization
  const safeTrades = Array.isArray(tradeSetups) ? tradeSetups : [];
  const safeCandles = Array.isArray(allCandles) ? allCandles : [];
  const safeSignals = Array.isArray(results?.signals) ? results.signals : [];

  const visibleCandles = replayMode ? safeCandles.slice(0, replayIndex) : safeCandles;

  return (
    <PageTransition className="min-h-screen bg-[#000000] px-4 py-16 text-white sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-black tracking-tight text-white">Strategy Lab</h1>
          
          <div className="flex rounded-xl bg-[#111111] p-1 border border-[#222222]">
            <button
              onClick={() => setActiveTab("run")}
              className={`flex items-center gap-2 px-6 py-2 text-sm font-bold transition rounded-lg ${
                activeTab === "run" ? "bg-white text-black" : "text-[#a0a0a0] hover:text-white"
              }`}
            >
              <Play size={14} /> Run Strategy
            </button>
            <button
              onClick={() => setActiveTab("results")}
              disabled={!results && !loading}
              className={`flex items-center gap-2 px-6 py-2 text-sm font-bold transition rounded-lg ${
                activeTab === "results" ? "bg-white text-black" : "text-[#a0a0a0] hover:text-white"
              } disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              <BarChart2 size={14} /> Results
            </button>
          </div>
        </div>

        {!isBackendOnline && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 px-5 py-4 text-sm text-rose-400 font-medium">
            Backend server not running.
          </div>
        )}

        {activeTab === "run" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-12">
              <GlassPanel className="border border-[#222222] bg-[#111111] p-6 lg:p-10">
                <div className="max-w-3xl mx-auto space-y-10">
                  <div className="space-y-4">
                    <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-[#555555]">
                       Step 1: Dataset Selection
                    </h2>
                    <div className={!isBackendOnline ? "pointer-events-none opacity-50 grayscale transition" : ""}>
                      <DatasetUploader appearance="monochrome" onUploadSuccess={setDataset} />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-[#555555]">
                       Step 2: Strategy Configuration
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <label className="block space-y-2">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#a0a0a0]">
                          Timeframe
                        </span>
                        <select
                          value={timeframe}
                          onChange={(event) => setTimeframe(event.target.value)}
                          className="w-full rounded-xl border border-[#222222] bg-[#000000] px-4 py-3 text-sm text-white outline-none transition focus:border-white"
                        >
                          {TIMEFRAMES.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="bg-[#0a0a0a] rounded-xl border border-[#1a1a1a] p-4 flex items-center justify-between">
                         <div>
                            <p className="text-[10px] uppercase tracking-[0.2em] text-[#555555]">Active Dataset</p>
                            <p className="text-sm font-bold text-white mt-1 truncate">
                               {dataset ? dataset.name : "None Selected"}
                            </p>
                         </div>
                         <div className={`w-3 h-3 rounded-full ${dataset ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                      </div>
                    </div>

                    <StrategyConfigurator
                      strategyId={strategyId}
                      parameters={parameters}
                      onStrategyChange={handleStrategyChange}
                      onParameterChange={handleParameterChange}
                    />
                  </div>

                  {/* ── Strategy Settings ───────────────────────────────────── */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Settings2 size={15} className="text-[#555555]" />
                      <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-[#555555]">
                        Step 3: Strategy Settings
                      </h2>
                    </div>
                    <StrategySettings settings={settings} onSettingChange={handleSettingChange} />
                  </div>

                  <button
                    type="button"
                    onClick={handleRunStrategy}
                    disabled={loading || !isBackendOnline}
                    className="w-full h-16 rounded-2xl bg-white text-black text-lg font-black transition hover:bg-[#e0e0e0] disabled:bg-[#333333] disabled:text-[#666666] disabled:cursor-not-allowed shadow-[0_8px_30px_rgb(255,255,255,0.1)]"
                  >
                    {loading ? "Processing Strategy..." : "Execute Strategy"}
                  </button>
                </div>
              </GlassPanel>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-8 min-h-[400px]">
             {loading ? (
                <div className="flex items-center justify-center h-[400px] text-gray-400 font-medium tracking-widest uppercase">
                   Running strategy...
                </div>
             ) : error ? (
                <div className="flex items-center justify-center h-[400px] text-red-400 font-medium p-6">
                   {error}
                </div>
             ) : !results || !Array.isArray(results.candles) || results.candles.length === 0 ? (
                <div className="flex items-center justify-center h-[400px] text-gray-500 font-medium tracking-widest uppercase p-6">
                   No results yet
                </div>
             ) : (
                <div className="flex flex-col gap-8">
                   {/* Performance metrics */}
                   <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                     <StatCard label="Total Trades" value={metrics.total_trades} />
                     <StatCard label="Buy Signals" value={metrics.buy_signals} accent="emerald" />
                     <StatCard label="Sell Signals" value={metrics.sell_signals} accent="rose" />
                     <StatCard label="Win Rate" value={`${(Number(metrics.win_rate || 0) * 100).toFixed(1)}%`} />
                     <StatCard 
                       label="Total Return" 
                       value={`${(Number(metrics.total_return || 0) * 100).toFixed(2)}%`} 
                       accent={metrics.total_return >= 0 ? "emerald" : "rose"}
                     />
                   </div>

                   {/* Strategy Chart */}
                   <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <Radar size={18} className="text-emerald-400" />
                           <h2 className="text-lg font-bold tracking-tight">Signal Analysis</h2>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setReplayMode((v) => !v);
                            setReplayIndex(0);
                            setReplayPlaying(false);
                          }}
                          className={`rounded-xl border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] transition ${
                            replayMode
                              ? "border-white bg-white text-black"
                              : "border-[#333333] text-[#555555] hover:border-white hover:text-white"
                          }`}
                        >
                          {replayMode ? "Exit Replay" : "Replay Mode"}
                        </button>
                      </div>

                      {replayMode && (
                        <ReplayControls
                          total={safeCandles.length}
                          index={replayIndex}
                          playing={replayPlaying}
                          speed={replaySpeed}
                          onPlay={() => setReplayPlaying(true)}
                          onPause={() => setReplayPlaying(false)}
                          onStep={(dir) => {
                            setReplayPlaying(false);
                            setReplayIndex((i) => Math.max(0, Math.min(safeCandles.length, i + dir)));
                          }}
                          onSpeedChange={setReplaySpeed}
                          onReset={() => { setReplayIndex(0); setReplayPlaying(false); }}
                        />
                      )}

                      {safeCandles.length > 0 ? (
                        <StrategyChart 
                           candles={visibleCandles} 
                           signals={safeSignals} 
                           selectedSetup={selectedSetup}
                        />
                      ) : (
                        <div className="flex h-[360px] items-center justify-center text-gray-500 border border-[#222222] rounded-2xl bg-[#111111]">
                          No data available
                        </div>
                      )}
                   </div>

                   <div className="space-y-4">
                     <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                       <h2 className="text-lg font-bold tracking-tight">Detected Setups</h2>
                       <input
                         type="date"
                         value={selectedDate}
                         onChange={(e) => setSelectedDate(e.target.value)}
                         className="rounded-xl border border-[#222222] bg-[#111111] px-4 py-2 text-sm text-white outline-none focus:border-white"
                       />
                     </div>
                     {safeTrades.length === 0 ? (
                       <GlassPanel className="border border-[#222222] bg-[#111111] p-10 text-center text-sm text-[#a0a0a0]">
                         {selectedDate ? "No trade setups found in this date" : "No trade setups were detected for this configuration."}
                       </GlassPanel>
                     ) : (
                       <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                         {safeTrades.map((setup, idx) => (
                           <SetupCard
                             key={`${setup.type}-${setup.index}-${idx}`}
                             setup={setup}
                             isActive={selectedSetup?.time === setup.time && selectedSetup?.type === setup.type}
                             onClick={() => {
                               console.log('Selected setup:', setup);
                               setSelectedSetup(setup);
                             }}
                           />
                         ))}
                       </div>
                     )}
                   </div>
                </div>
             )}
          </div>
        )}
      </div>
    </PageTransition>
  );
}

function StatCard({ label, value, accent }) {
  const colorMap = { emerald: "text-emerald-400", rose: "text-rose-400" };
  return (
    <GlassPanel className="border border-[#222222] bg-[#111111] px-5 py-6">
      <p className="text-[10px] uppercase tracking-[0.2em] text-[#555555] font-bold">{label}</p>
      <p className={`mt-2 text-2xl font-black ${accent ? colorMap[accent] : "text-white"}`}>
        {value ?? "—"}
      </p>
    </GlassPanel>
  );
}
