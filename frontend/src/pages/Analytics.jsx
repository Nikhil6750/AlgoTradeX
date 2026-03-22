import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

import DurationHistogram from "../components/charts/DurationHistogram";
import EquityChart from "../components/charts/EquityChart";
import PnLHistogram from "../components/charts/PnLHistogram";
import WinLossPie from "../components/charts/WinLossPie";
import GlassPanel from "../components/ui/GlassPanel";
import PageTransition from "../components/ui/PageTransition";
import { formatDateTime, formatPercent, formatPlainPercent } from "../lib/formatters";
import { fetchBacktest, fetchBacktests } from "../lib/researchApi";

export default function Analytics() {
  const [backtests, setBacktests] = useState([]);
  const [allTrades, setAllTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    async function load() {
      const cached = sessionStorage.getItem("analytics");
      if (cached) {
        if (active) {
          const parsed = JSON.parse(cached);
          setBacktests(parsed.backtests);
          setAllTrades(parsed.allTrades);
          setLoading(false);
        }
      } else {
        if (active) setLoading(true);
      }

      if (active) setError(false);

      try {
        console.log("Analytics: fetching backtests...");
        const items = await fetchBacktests(50);
        console.log("Analytics: received", items.length, "backtests");
        if (!active) return;
        
        setBacktests(items);

        // N+1 Optimization: Limit trades fetch to top 5
        const detailRows = await Promise.allSettled(
          items.slice(0, 5).map((backtest) => fetchBacktest(backtest.id))
        );
        if (!active) return;
        
        const fetchedTrades = detailRows
          .filter((row) => row.status === "fulfilled")
          .flatMap((row) => row.value.trades || []);
          
        setAllTrades(fetchedTrades);
        
        sessionStorage.setItem("analytics", JSON.stringify({ backtests: items, allTrades: fetchedTrades }));
      } catch (_error) {
        if (active) {
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
  }, []);

  const profitableBacktests = useMemo(
    () => backtests.filter((backtest) => Number(backtest.profit || 0) > 0).length,
    [backtests],
  );

  if (!loading && backtests.length === 0) {
    console.warn("No backtest data");
  }

  return (
    <PageTransition className="min-h-screen bg-[#000000] px-4 py-16 text-white sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#a0a0a0]">Analytics</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-white">Cross-backtest performance analysis</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#a0a0a0]">
            Aggregate behavior across stored backtests so you can compare profit distribution, win/loss balance, and trade duration across recent research runs.
          </p>
        </div>

        {error ? (
          <div className="text-red-500 font-medium">Failed to load data</div>
        ) : loading && backtests.length === 0 ? (
          <GlassPanel className="border border-[#222222] bg-[#111111] p-12 text-center text-sm text-[#a0a0a0]">
            Loading analytics...
          </GlassPanel>
        ) : backtests.length === 0 ? (
          <GlassPanel className="border border-[#222222] bg-[#111111] p-12 text-center">
            <h2 className="text-2xl font-black text-white">No analytics yet</h2>
            <p className="mt-3 text-sm text-[#a0a0a0]">Run a backtest to populate aggregate analytics.</p>
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
            <div className="grid gap-4 md:grid-cols-3">
              <SummaryCard label="Backtests Analyzed" value={backtests.length} />
              <SummaryCard label="Trades Aggregated" value={allTrades.length} />
              <SummaryCard label="Profitable Backtests" value={`${profitableBacktests}/${backtests.length}`} />
            </div>

            <GlassPanel className="border border-[#222222] bg-[#111111] p-5">
              <div className="mb-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-[#a0a0a0]">Aggregate Equity</p>
                <h2 className="mt-2 text-2xl font-black text-white">Combined trade path</h2>
              </div>
              <div className="h-[280px] overflow-hidden rounded-3xl border border-[#222222] bg-[#000000]">
                {allTrades.length > 0 ? (
                  <EquityChart trades={allTrades} />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-500">
                    No data available
                  </div>
                )}
              </div>
            </GlassPanel>

            <div className="grid gap-6 xl:grid-cols-3">
              {allTrades.length > 0 ? (
                <PnLHistogram trades={allTrades} />
              ) : (
                <div className="flex h-[200px] items-center justify-center rounded-3xl border border-[#222222] bg-[#111111] text-gray-500">
                  No data available
                </div>
              )}
              {allTrades.length > 0 ? (
                <WinLossPie trades={allTrades} />
              ) : (
                <div className="flex h-[200px] items-center justify-center rounded-3xl border border-[#222222] bg-[#111111] text-gray-500">
                  No data available
                </div>
              )}
              {allTrades.length > 0 ? (
                <DurationHistogram trades={allTrades} />
              ) : (
                <div className="flex h-[200px] items-center justify-center rounded-3xl border border-[#222222] bg-[#111111] text-gray-500">
                  No data available
                </div>
              )}
            </div>

            <GlassPanel className="border border-[#222222] bg-[#111111] p-5">
              <div className="mb-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-[#a0a0a0]">Recent Research Runs</p>
                <h2 className="mt-2 text-2xl font-black text-white">Backtest comparison</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-sm">
                  <thead>
                    <tr className="border-b border-[#222222] text-left text-[11px] uppercase tracking-[0.24em] text-[#a0a0a0]">
                      {["Backtest", "Dataset", "Strategy", "Profit", "Win Rate", "Trades", "Drawdown", "Created"].map((header) => (
                        <th key={header} className="px-3 py-3 font-semibold">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {backtests.map((backtest) => (
                      <tr
                        key={backtest.id}
                        onClick={() => navigate(`/results/${backtest.id}`)}
                        className="cursor-pointer border-b border-[#222222] transition hover:bg-[#161616]"
                      >
                        <td className="px-3 py-4 font-semibold text-white">#{backtest.id}</td>
                        <td className="px-3 py-4 text-[#a0a0a0]">{backtest.dataset_name}</td>
                        <td className="px-3 py-4 text-[#a0a0a0]">{backtest.strategy_name}</td>
                        <td className="px-3 py-4 font-semibold text-white">
                          {formatPercent(backtest.profit)}
                        </td>
                        <td className="px-3 py-4 text-[#a0a0a0]">{formatPlainPercent(backtest.win_rate)}</td>
                        <td className="px-3 py-4 text-[#a0a0a0]">{backtest.total_trades}</td>
                        <td className="px-3 py-4 text-white">{formatPercent(backtest.max_drawdown)}</td>
                        <td className="px-3 py-4 text-[#a0a0a0]">{formatDateTime(backtest.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassPanel>
          </>
        )}
      </div>
    </PageTransition>
  );
}

function SummaryCard({ label, value }) {
  return (
    <GlassPanel className="border border-[#222222] bg-[#111111] p-5">
      <p className="text-[11px] uppercase tracking-[0.24em] text-[#a0a0a0]">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-tight text-white">{value}</p>
    </GlassPanel>
  );
}
