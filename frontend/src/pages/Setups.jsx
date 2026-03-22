import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Radar } from "lucide-react";

import ReplayChart from "../components/charts/ReplayChart";
import GlassPanel from "../components/ui/GlassPanel";
import PageTransition from "../components/ui/PageTransition";
import { formatDateTime } from "../lib/formatters";
import { fetchBacktest } from "../lib/researchApi";

function normalizeSignals(setups, candles, type) {
  return (setups || [])
    .filter((setup) => String(setup.type || "").toUpperCase() === type)
    .map((setup) => {
      const candle = candles?.[Number(setup.index)] || {};
      return {
        time: setup.timestamp || candle.time,
        price: setup.price || candle.close,
        type,
      };
    });
}

export default function Setups() {
  const { backtestId } = useParams();
  const [backtest, setBacktest] = useState(null);
  const [selectedSetupId, setSelectedSetupId] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    fetchBacktest(backtestId)
      .then((data) => {
        if (!active) {
          return;
        }
        setBacktest(data);
        setSelectedSetupId(String(data.trade_setups?.[0]?.id || `${data.trade_setups?.[0]?.type || ""}-${data.trade_setups?.[0]?.index || 0}`));
      })
      .catch(() => {
        if (active) {
          setBacktest(null);
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
  }, [backtestId]);

  const tradeSetups = useMemo(
    () => (backtest?.trade_setups || []).map((setup, index) => ({
      id: String(setup.id || `${setup.type}-${setup.index}-${index}`),
      ...setup,
    })),
    [backtest?.trade_setups],
  );
  const activeSetup = tradeSetups.find((setup) => setup.id === selectedSetupId) || tradeSetups[0] || null;
  const candles = backtest?.candles || [];
  const buySignals = useMemo(() => normalizeSignals(tradeSetups, candles, "BUY"), [candles, tradeSetups]);
  const sellSignals = useMemo(() => normalizeSignals(tradeSetups, candles, "SELL"), [candles, tradeSetups]);

  return (
    <PageTransition className="min-h-screen bg-[#000000] px-4 py-16 text-white sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#a0a0a0]">Setups</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-white">
              {backtestId ? `Backtest #${backtestId} setup review` : "Setup review"}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#a0a0a0]">
              Strategy evaluations land here immediately after execution so you can inspect the indexed trade setups before moving to detailed results.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/results/${backtestId}`)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#222222] bg-[#111111] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#161616]"
          >
            Open Detailed Results
            <ArrowRight size={16} />
          </button>
        </div>

        {loading ? (
          <GlassPanel className="border border-[#222222] bg-[#111111] p-12 text-center text-sm text-[#a0a0a0]">
            Loading setups...
          </GlassPanel>
        ) : !backtest ? (
          <GlassPanel className="border border-[#222222] bg-[#111111] p-12 text-center text-sm text-[#a0a0a0]">
            Backtest not found.
          </GlassPanel>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
            <GlassPanel className="border border-[#222222] bg-[#111111] p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-[#222222] bg-[#111111] p-3 text-white">
                  <Radar size={18} />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-[#a0a0a0]">Detected Setups</p>
                  <h2 className="mt-1 text-2xl font-black text-white">{tradeSetups.length}</h2>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {tradeSetups.length === 0 ? (
                  <div className="rounded-3xl border border-[#222222] bg-[#111111] px-5 py-8 text-sm text-[#a0a0a0]">
                    No indexed setups were returned for this run. The full metrics are still available in Results.
                  </div>
                ) : (
                  tradeSetups.map((setup) => (
                    <button
                      key={setup.id}
                      type="button"
                      onClick={() => setSelectedSetupId(setup.id)}
                      className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                        activeSetup?.id === setup.id
                          ? "border-white bg-[#111111]"
                          : "border-[#222222] bg-[#111111] hover:bg-[#161616]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">
                          {setup.type}
                        </span>
                        <span className="text-xs text-[#a0a0a0]">Index {setup.index}</span>
                      </div>
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[#a0a0a0]">Signal Time</p>
                      <p className="mt-1 text-sm text-white">
                        {setup.timestamp ? formatDateTime(Number(setup.timestamp) * 1000) : "—"}
                      </p>
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[#a0a0a0]">Price</p>
                      <p className="mt-1 text-sm text-white">{Number(setup.price || 0).toFixed(4)}</p>
                    </button>
                  ))
                )}
              </div>
            </GlassPanel>

            <GlassPanel className="border border-[#222222] bg-[#111111] p-5">
              <div className="mb-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-[#a0a0a0]">Chart Inspection</p>
                <h2 className="mt-2 text-2xl font-black text-white">Review detected setup placement</h2>
              </div>

              <div className="mb-4 grid gap-4 md:grid-cols-3">
                <MetaCard label="Dataset" value={backtest.dataset?.filename || backtest.dataset_name} />
                <MetaCard label="Strategy" value={backtest.strategy_name} />
                <MetaCard label="Backtest" value={`#${backtest.id}`} />
              </div>

              <div className="h-[640px] overflow-hidden rounded-3xl border border-[#222222] bg-[#000000]">
                {candles.length > 0 ? (
                  <ReplayChart
                    datasetKey={`setups-${backtest.id}`}
                    candles={candles}
                    cursor={candles.length - 1}
                    buySignals={buySignals}
                    sellSignals={sellSignals}
                    completedTrades={backtest.trades || []}
                    highlightedSetup={activeSetup}
                    mode="inspect"
                    centerOnIndex={activeSetup ? Number(activeSetup.index) : null}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-8 text-center text-sm text-[#a0a0a0]">
                    Candle data is unavailable for this backtest.
                  </div>
                )}
              </div>
            </GlassPanel>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

function MetaCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-[#222222] bg-[#111111] px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.2em] text-[#a0a0a0]">{label}</p>
      <p className="mt-3 text-sm font-semibold text-white">{value || "—"}</p>
    </div>
  );
}
