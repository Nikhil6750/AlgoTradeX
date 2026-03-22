import { useEffect, useState } from "react";
import axios from "axios";
import { TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";

function ScoreBar({ score }) {
  // score in [-1, 1]; map to 0-100 for display
  const pct     = Math.round(((score + 1) / 2) * 100);
  const positive = score > 0.05;
  const negative = score < -0.05;
  const color    = positive ? "#10b981" : negative ? "#ef4444" : "#555555";

  return (
    <div className="space-y-1.5">
      <div className="h-1.5 w-full rounded-full bg-[#1a1a1a]">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-[#444444]">
        <span>Bearish</span>
        <span>Bullish</span>
      </div>
    </div>
  );
}

function SentimentBadge({ sentiment }) {
  const map = {
    positive: { color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", icon: <TrendingUp size={10} /> },
    negative: { color: "text-rose-400 bg-rose-400/10 border-rose-400/20",         icon: <TrendingDown size={10} /> },
    neutral:  { color: "text-[#555555] bg-[#111111] border-[#222222]",            icon: <Minus size={10} /> },
  };
  const style = map[sentiment] ?? map.neutral;
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.color}`}>
      {style.icon} {sentiment}
    </span>
  );
}

export default function SentimentPanel() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    axios.get("/market-sentiment")
      .then(r => { if (!cancelled) setData(r.data); })
      .catch(() => {}) // silent — panel just stays loading
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-5 animate-pulse">
        <div className="h-3 w-40 rounded bg-[#1a1a1a] mb-3" />
        <div className="h-1.5 w-full rounded bg-[#1a1a1a]" />
      </div>
    );
  }

  if (!data) return null;

  const score         = data.market_score ?? 0;
  const events        = data.macro_events ?? [];
  const topEvents     = events.slice(0, 5);
  
  const positiveCount = events.filter(e => e.sentiment?.toLowerCase().includes("bullish")).length;
  const negativeCount = events.filter(e => e.sentiment?.toLowerCase().includes("bearish")).length;
  const neutralCount  = events.filter(e => e.sentiment?.toLowerCase().includes("neutral")).length;

  const overallSentiment = score > 0.05 ? "positive" : score < -0.05 ? "negative" : "neutral";

  return (
    <div className="rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-[#555555]" />
          <h3 className="text-sm font-bold tracking-tight">Market Sentiment</h3>
        </div>
        <SentimentBadge sentiment={overallSentiment} />
      </div>

      {/* Score bar */}
      <ScoreBar score={score} />

      {/* Counts */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Positive", count: positiveCount, color: "text-emerald-400" },
          { label: "Neutral",  count: neutralCount,  color: "text-[#555555]" },
          { label: "Negative", count: negativeCount, color: "text-rose-400" },
        ].map(({ label, count, color }) => (
          <div key={label} className="rounded-xl border border-[#1a1a1a] bg-[#111111] p-3 text-center">
            <p className={`text-xl font-black ${color}`}>{count}</p>
            <p className="text-[10px] uppercase tracking-[0.15em] text-[#444444] mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Top events */}
      {topEvents.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#333333] font-bold">Key Events</p>
          <div className="space-y-1.5">
            {topEvents.map((ev, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-[#1a1a1a] bg-[#111111] px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-white truncate">{ev.event}</p>
                  <p className="text-[10px] text-[#444444]">
                    {ev.country} · {ev.importance}
                    {ev.actual   ? ` · A: ${ev.actual}` : ""}
                    {ev.forecast ? ` · F: ${ev.forecast}` : ""}
                  </p>
                </div>
                <SentimentBadge sentiment={ev.sentiment ?? "neutral"} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
