import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Clock3, Sparkles, Target } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import PageTransition from "../components/ui/PageTransition";
import GlassPanel from "../components/ui/GlassPanel";
import { fetchDashboardOverview } from "../lib/researchApi";
import {
  formatDateTime,
  formatPercent,
  formatPlainPercent,
} from "../lib/formatters";

function StatCard({ label, value, detail, Icon }) {
  return (
    <GlassPanel className="relative overflow-hidden border border-[#222222] bg-[#111111]">
      <div className="absolute inset-x-0 top-0 h-1 bg-[#222222]" />
      <div className="flex items-start justify-between p-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#a0a0a0]">
            {label}
          </p>
          <p className="mt-3 text-3xl font-black tracking-tight text-white">
            {value}
          </p>
          <p className="mt-2 text-sm text-[#a0a0a0]">{detail}</p>
        </div>
        <div className="rounded-2xl border border-[#222222] bg-[#111111] p-3 text-white">
          <Icon size={18} />
        </div>
      </div>
    </GlassPanel>
  );
}

function EmptyState() {
  const navigate = useNavigate();

  return (
    <GlassPanel className="border border-[#222222] bg-[#111111] p-8 text-center">
      <p className="text-[11px] uppercase tracking-[0.24em] text-[#a0a0a0]">
        Research Starts Here
      </p>
      <h2 className="mt-3 text-3xl font-black tracking-tight text-white">
        No backtests recorded yet
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[#a0a0a0]">
        Upload a dataset in Strategy Lab, run an evaluation, and the platform
        will start building a persistent backtest history.
      </p>
      <button
        type="button"
        onClick={() => navigate("/strategy-lab")}
        className="mt-6 rounded-2xl border border-[#222222] bg-[#111111] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#161616]"
      >
        Open Strategy Lab
      </button>
    </GlassPanel>
  );
}

function CinematicIntro({ onComplete }) {
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    // Fade in: 1s. Zoom display. Total before fade out: 2.7s
    const timer1 = setTimeout(() => {
      setFadingOut(true);
    }, 2700);

    // Fade out length: 0.8s. Unmount at 3.5s
    const timer2 = setTimeout(() => {
      onComplete();
    }, 3500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-[800ms] ease-in ${
        fadingOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{
        background:
          "radial-gradient(circle at center, rgba(20,20,25,0.5), #000000 70%)",
      }}
    >
      {/* ── Background: Glow Pulse Behind Title (Neutral / Slight Blue) ── */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-r from-[rgba(80,120,255,0.08)] to-[rgba(255,255,255,0.03)] rounded-full blur-[120px] pointer-events-none" />

      {/* ── Content Wrapper (Controls Zoom) ── */}
      <div className="relative z-10 flex flex-col items-center animate-[zoomForward_3.5s_ease-in-out_forwards]">
        {/* Title */}
        <h1
          className="text-[#e5e7eb] font-[700] opacity-0 animate-[introFadeIn_1s_ease-out_forwards] leading-none"
          style={{
            fontSize: "84px",
            textShadow: "0 0 18px rgba(255,255,255,0.08)",
          }}
        >
          AlgoTradeX
        </h1>

        {/* Tagline */}
        <p
          className="text-[#9ca3af] text-[18px] mt-[12px] opacity-0 animate-[introFadeIn_1s_ease-out_forwards]"
          style={{ animationDelay: "0.4s" }}
        >
          AI-driven trading intelligence
        </p>
      </div>

      <style jsx>{`
        @keyframes introFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes zoomForward {
          0% {
            transform: scale(1);
          }
          70% {
            transform: scale(1.15);
          }
          100% {
            transform: scale(1.25);
          }
        }
      `}</style>
    </div>
  );
}

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showIntro, setShowIntro] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    fetchDashboardOverview()
      .then((data) => {
        if (active) {
          setOverview(data);
        }
      })
      .catch(() => {
        if (active) {
          setOverview({
            total_backtests: 0,
            total_strategies: 0,
            best_strategy: "No strategies yet",
            win_rate: 0,
            recent_backtests: [],
            equity_curve_preview: [],
          });
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

  const recentPerformance = useMemo(
    () =>
      (overview?.recent_backtests || [])
        .slice()
        .reverse()
        .map((backtest) => ({
          name: `#${backtest.id}`,
          profit: Number(((backtest.profit || 0) * 100).toFixed(2)),
        })),
    [overview?.recent_backtests],
  );

  return (
    <>
      {showIntro && <CinematicIntro onComplete={() => setShowIntro(false)} />}
      <PageTransition
        className={`min-h-screen bg-[#000000] px-4 py-16 text-white sm:px-6 lg:px-10 ${
          showIntro
            ? "opacity-0 pointer-events-none"
            : "animate-in fade-in duration-[600ms]"
        }`}
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-[#a0a0a0]">
                Dashboard
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-white">
                AlgoTradeX Command Center
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#a0a0a0]">
                Persistent backtests, recent research activity, and a quick read
                on what is working across your datasets.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/strategy-lab")}
              className="rounded-2xl border border-[#222222] bg-[#111111] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#161616]"
            >
              Run New Evaluation
            </button>
          </div>

          {loading ? (
            <GlassPanel className="border border-[#222222] bg-[#111111] p-12 text-center text-sm text-[#a0a0a0]">
              Loading dashboard overview...
            </GlassPanel>
          ) : overview?.total_backtests === 0 ? (
            <EmptyState />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Total Backtests"
                  value={overview.total_backtests}
                  detail="All persisted strategy runs"
                  Icon={Activity}
                />
                <StatCard
                  label="Total Strategies"
                  value={overview.total_strategies}
                  detail="Unique stored strategy configurations"
                  Icon={Target}
                />
                <StatCard
                  label="Best Strategy"
                  value={overview.best_strategy}
                  detail="Highest average profit across stored runs"
                  Icon={Sparkles}
                />
                <StatCard
                  label="Win Rate"
                  value={formatPlainPercent(overview.win_rate)}
                  detail="Weighted across all recorded trades"
                  Icon={Clock3}
                />
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
                <GlassPanel className="border border-[#222222] bg-[#111111] p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-[#a0a0a0]">
                        Equity Curve Preview
                      </p>
                      <h2 className="mt-2 text-2xl font-black text-white">
                        Latest research trajectory
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate("/backtests")}
                      className="rounded-xl border border-[#222222] px-3 py-2 text-xs font-semibold text-[#a0a0a0] transition hover:bg-[#161616] hover:text-white"
                    >
                      Open Backtests
                    </button>
                  </div>

                  <div className="h-[320px] rounded-3xl border border-[#222222] bg-[#000000] p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={overview.equity_curve_preview || []}>
                        <defs>
                          <linearGradient
                            id="equityPreview"
                            x1="0"
                            x2="0"
                            y1="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#ffffff"
                              stopOpacity={0.28}
                            />
                            <stop
                              offset="95%"
                              stopColor="#ffffff"
                              stopOpacity={0.02}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          stroke="rgba(255,255,255,0.05)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="time"
                          tick={false}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#a0a0a0", fontSize: 11 }}
                          width={70}
                        />
                        <Tooltip
                          formatter={(value) => Number(value).toFixed(2)}
                          labelFormatter={(value) =>
                            formatDateTime(Number(value) * 1000)
                          }
                          contentStyle={{
                            background: "#111111",
                            border: "1px solid #222222",
                            borderRadius: 16,
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#ffffff"
                          strokeWidth={2.5}
                          fill="url(#equityPreview)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </GlassPanel>

                <GlassPanel className="border border-[#222222] bg-[#111111] p-5">
                  <div className="mb-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-[#a0a0a0]">
                      Recent Backtests
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      Performance snapshot
                    </h2>
                  </div>

                  <div className="h-[320px] rounded-3xl border border-[#222222] bg-[#000000] p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={recentPerformance}>
                        <CartesianGrid
                          stroke="rgba(255,255,255,0.05)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="name"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#a0a0a0", fontSize: 11 }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#a0a0a0", fontSize: 11 }}
                        />
                        <Tooltip
                          formatter={(value) => `${Number(value).toFixed(2)}%`}
                          contentStyle={{
                            background: "#111111",
                            border: "1px solid #222222",
                            borderRadius: 16,
                          }}
                        />
                        <Bar
                          dataKey="profit"
                          fill="#ffffff"
                          radius={[8, 8, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </GlassPanel>
              </div>

              <GlassPanel className="border border-[#222222] bg-[#111111] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-[#a0a0a0]">
                      Recent Backtests
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      Latest research runs
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/backtests")}
                    className="rounded-xl border border-[#222222] px-3 py-2 text-xs font-semibold text-[#a0a0a0] transition hover:bg-[#161616] hover:text-white"
                  >
                    View All
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="border-b border-[#222222] text-left text-[11px] uppercase tracking-[0.24em] text-[#a0a0a0]">
                        {[
                          "Backtest",
                          "Dataset",
                          "Strategy",
                          "Profit",
                          "Win Rate",
                          "Trades",
                          "Created",
                        ].map((header) => (
                          <th key={header} className="px-3 py-3 font-semibold">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(overview.recent_backtests || []).map((backtest) => (
                        <tr
                          key={backtest.id}
                          onClick={() => navigate(`/results/${backtest.id}`)}
                          className="cursor-pointer border-b border-[#222222] transition hover:bg-[#161616]"
                        >
                          <td className="px-3 py-4 font-semibold text-white">
                            #{backtest.id}
                          </td>
                          <td className="px-3 py-4 text-[#a0a0a0]">
                            {backtest.dataset_name}
                          </td>
                          <td className="px-3 py-4 text-[#a0a0a0]">
                            {backtest.strategy_name}
                          </td>
                          <td className="px-3 py-4 font-semibold text-white">
                            {formatPercent(backtest.profit)}
                          </td>
                          <td className="px-3 py-4 text-[#a0a0a0]">
                            {formatPlainPercent(backtest.win_rate)}
                          </td>
                          <td className="px-3 py-4 text-[#a0a0a0]">
                            {backtest.total_trades}
                          </td>
                          <td className="px-3 py-4 text-[#a0a0a0]">
                            {formatDateTime(backtest.created_at)}
                          </td>
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
    </>
  );
}
