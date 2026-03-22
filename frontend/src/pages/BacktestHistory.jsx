import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { History, Search } from "lucide-react";

import GlassPanel from "../components/ui/GlassPanel";
import PageTransition from "../components/ui/PageTransition";
import { formatDateTime, formatPercent, formatPlainPercent } from "../lib/formatters";
import { fetchBacktests } from "../lib/researchApi";

export default function BacktestHistory() {
  const [backtests, setBacktests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    fetchBacktests(500)
      .then((items) => {
        if (active) {
          setBacktests(items);
        }
      })
      .catch(() => {
        if (active) {
          setBacktests([]);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return backtests;
    }

    return backtests.filter((backtest) =>
      [
        backtest.dataset_name,
        backtest.strategy_name,
        String(backtest.id),
      ].some((value) => String(value || "").toLowerCase().includes(normalizedQuery)),
    );
  }, [backtests, query]);

  return (
    <PageTransition className="min-h-screen bg-[#000000] px-4 py-16 text-white sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#a0a0a0]">Backtests</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-white">Persistent backtest history</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#a0a0a0]">
              Every strategy execution creates a backtest record. Browse historical runs by dataset, strategy, and timestamp.
            </p>
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-[#222222] bg-[#111111] px-4 py-3 text-sm text-[#a0a0a0]">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by backtest, dataset, or strategy"
              className="w-[280px] bg-transparent outline-none placeholder:text-[#a0a0a0]"
            />
          </label>
        </div>

        <GlassPanel className="border border-[#222222] bg-[#111111] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-[#222222] bg-[#111111] p-3 text-white">
                <History size={18} />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-[#a0a0a0]">Stored Runs</p>
                <h2 className="mt-1 text-2xl font-black text-white">{filtered.length} backtests</h2>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-[#222222] bg-[#111111] px-6 py-16 text-center text-sm text-[#a0a0a0]">
              Loading backtest history...
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-3xl border border-[#222222] bg-[#111111] px-6 py-16 text-center text-sm text-[#a0a0a0]">
              No backtests match the current filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-[#222222] text-left text-[11px] uppercase tracking-[0.24em] text-[#a0a0a0]">
                    {["Backtest", "Dataset", "Strategy", "Timeframe", "Profit", "Win Rate", "Trades", "Drawdown", "Created"].map((header) => (
                      <th key={header} className="px-3 py-3 font-semibold">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((backtest) => (
                    <tr
                      key={backtest.id}
                      onClick={() => navigate(`/results/${backtest.id}`)}
                      className="cursor-pointer border-b border-[#222222] transition hover:bg-[#161616]"
                    >
                      <td className="px-3 py-4 font-semibold text-white">#{backtest.id}</td>
                      <td className="px-3 py-4 text-[#a0a0a0]">{backtest.dataset_name}</td>
                      <td className="px-3 py-4 text-[#a0a0a0]">{backtest.strategy_name}</td>
                      <td className="px-3 py-4 text-[#a0a0a0]">{backtest.timeframe}</td>
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
          )}
        </GlassPanel>
      </div>
    </PageTransition>
  );
}
