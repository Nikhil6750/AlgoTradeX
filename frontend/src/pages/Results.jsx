import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BarChart3, LineChart, TrendingDown, TrendingUp } from "lucide-react";

import DrawdownChart from "../components/charts/DrawdownChart";
import EquityChart from "../components/charts/EquityChart";
import TradeHistory from "../components/trading/TradeHistory";
import GlassPanel from "../components/ui/GlassPanel";
import PageTransition from "../components/ui/PageTransition";
import { formatDateTime, formatNumber, formatPercent, formatPlainPercent } from "../lib/formatters";
import { fetchBacktest, fetchBacktests } from "../lib/researchApi";

function MetricCard({ label, value, Icon }) {
  return (
    <GlassPanel className="border border-[#222222] bg-[#111111] p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#a0a0a0]">{label}</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-white">{value}</p>
        </div>
        <div className="rounded-2xl border border-[#222222] bg-[#111111] p-3 text-white">
          <Icon size={18} />
        </div>
      </div>
    </GlassPanel>
  );
}

export default function Results() {
  const { backtestId: routeBacktestId } = useParams();
  const [backtest, setBacktest] = useState(null);
  const [resolvedBacktestId, setResolvedBacktestId] = useState(routeBacktestId || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    async function load() {
      let targetId = routeBacktestId;
      
      const cachedRecent = sessionStorage.getItem("recent");
      if (!targetId && cachedRecent) {
        const recent = JSON.parse(cachedRecent);
        targetId = recent[0]?.id ? String(recent[0].id) : "";
      }

      const cacheKey = targetId ? `result_${targetId}` : null;
      if (cacheKey) {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached && active) {
           // Show cached data instantly (SWR: update in background below)
           setResolvedBacktestId(String(targetId));
           setBacktest(JSON.parse(cached));
           setLoading(false);
        } else if (active) {
           setLoading(true);
        }
      } else if (active) {
         setLoading(true);
      }

      if (active) setError(false);

      try {
        if (!targetId) {
           console.log("No backtest ID in route — fetching most recent...");
           const recent = await fetchBacktests(1);
           if (active) {
               sessionStorage.setItem("recent", JSON.stringify(recent));
               targetId = recent[0]?.id ? String(recent[0].id) : "";
               console.log("Resolved most recent backtest ID:", targetId);
           }
        }

        if (!targetId) {
          if (active) setBacktest(null);
          return;
        }

        console.log("Fetching backtest:", targetId);
        const data = await fetchBacktest(targetId);
        console.log("Backtest data received:", data);
        
        if (active) {
          sessionStorage.setItem(`result_${targetId}`, JSON.stringify(data));
          setResolvedBacktestId(String(targetId));
          setBacktest(data);
        }
      } catch (err) {
        console.error("Backtest fetch failed:", err);
        if (active) {
          setBacktest(null);
          setError(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [routeBacktestId]);

  const metrics = backtest?.metrics || {};
  const trades = useMemo(() => backtest?.trades || [], [backtest?.trades]);

  if (!loading && !backtest) {
    console.warn("No backtest data");
  }

  return (
    <PageTransition className="min-h-screen bg-[#000000] px-4 py-16 text-white sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#a0a0a0]">Results</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-white">
              {resolvedBacktestId ? `Backtest #${resolvedBacktestId}` : "Detailed backtest results"}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#a0a0a0]">
              Detailed metrics for a selected backtest, including the equity curve, drawdown, profit factor, Sharpe ratio, and full trade list.
            </p>
          </div>

          {backtest && (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate("/backtests")}
                className="rounded-2xl border border-[#222222] px-4 py-3 text-sm font-semibold text-[#a0a0a0] transition hover:bg-[#161616] hover:text-white"
              >
                View All Backtests
              </button>
              <button
                type="button"
                onClick={() => navigate(`/setups/${backtest.id}`)}
                className="rounded-2xl border border-[#222222] bg-[#111111] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#161616]"
              >
                Open Setups
              </button>
            </div>
          )}
        </div>

        {error ? (
          <div className="text-red-500 font-medium">Failed to load data</div>
        ) : loading && !backtest ? (
          <GlassPanel className="border border-[#222222] bg-[#111111] p-12 text-center text-sm text-[#a0a0a0]">
            Loading backtest results...
          </GlassPanel>
        ) : !backtest ? (
          <GlassPanel className="border border-[#222222] bg-[#111111] p-12 text-center">
            <h2 className="text-2xl font-black text-white">No backtest selected</h2>
            <p className="mt-3 text-sm text-[#a0a0a0]">
              Run a strategy evaluation or pick a stored backtest from the Backtests page.
            </p>
            <button
              type="button"
              onClick={() => navigate("/strategy-lab")}
              className="mt-6 rounded-2xl border border-[#222222] bg-[#111111] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#161616]"
            >
              Open Strategy Lab
            </button>
          </GlassPanel>
        ) : (
          <>
            <GlassPanel className="border border-[#222222] bg-[#111111] p-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <MetricCard label="Profit" value={formatPercent(backtest.profit)} Icon={TrendingUp} />
                <MetricCard label="Win Rate" value={formatPlainPercent(backtest.win_rate)} Icon={BarChart3} />
                <MetricCard label="Total Trades" value={backtest.total_trades} Icon={LineChart} />
                <MetricCard label="Profit Factor" value={formatNumber(metrics.profit_factor)} Icon={TrendingUp} />
                <MetricCard label="Sharpe Ratio" value={formatNumber(metrics.sharpe_ratio)} Icon={TrendingDown} />
              </div>
            </GlassPanel>

            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <GlassPanel className="border border-[#222222] bg-[#111111] p-5">
                <div className="mb-4">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-[#a0a0a0]">Equity Curve</p>
                  <h2 className="mt-2 text-2xl font-black text-white">Portfolio trajectory</h2>
                </div>
                <div className="h-[320px] overflow-hidden rounded-3xl border border-[#222222] bg-[#000000]">
                  {trades.length > 0 ? (
                    <EquityChart trades={trades} />
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-500">
                      No trade data
                    </div>
                  )}
                </div>
              </GlassPanel>

              <GlassPanel className="border border-[#222222] bg-[#111111] p-5">
                <div className="mb-4">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-[#a0a0a0]">Drawdown</p>
                  <h2 className="mt-2 text-2xl font-black text-white">Peak-to-trough pressure</h2>
                </div>
                <div className="h-[320px] overflow-hidden rounded-3xl border border-[#222222] bg-[#000000]">
                  {trades.length > 0 ? (
                    <DrawdownChart trades={trades} />
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-500">
                      No trade data
                    </div>
                  )}
                </div>
              </GlassPanel>
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <GlassPanel className="border border-[#222222] bg-[#111111] p-5">
                <p className="text-[11px] uppercase tracking-[0.24em] text-[#a0a0a0]">Backtest Meta</p>
                <h2 className="mt-2 text-2xl font-black text-white">Execution context</h2>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <MetaCard label="Dataset" value={backtest.dataset?.filename || backtest.dataset_name} />
                  <MetaCard label="Strategy" value={backtest.strategy_name} />
                  <MetaCard label="Timeframe" value={backtest.timeframe} />
                  <MetaCard label="Created" value={formatDateTime(backtest.created_at)} />
                  <MetaCard label="Max Drawdown" value={formatPercent(backtest.max_drawdown)} />
                  <MetaCard label="Trade Setups" value={backtest.trade_setups?.length || 0} />
                </div>
              </GlassPanel>

              <GlassPanel className="border border-[#222222] bg-[#111111] p-5">
                <p className="text-[11px] uppercase tracking-[0.24em] text-[#a0a0a0]">Trade List</p>
                <h2 className="mt-2 text-2xl font-black text-white">Executed trades</h2>
                <div className="mt-5 h-[420px]">
                  <TradeHistory trades={trades} selectedTrade={null} onSelectTrade={() => {}} />
                </div>
              </GlassPanel>
            </div>
          </>
        )}
      </div>
    </PageTransition>
  );
}

function MetaCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-[#222222] bg-[#111111] px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.2em] text-[#a0a0a0]">{label}</p>
      <p className="mt-3 text-sm font-semibold leading-6 text-white">{value || "—"}</p>
    </div>
  );
}
