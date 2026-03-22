import { useEffect, useState } from "react";
import axios from "axios";
import { Activity, RefreshCw, X, AlertCircle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import PageTransition from "../components/ui/PageTransition";
import toast from "react-hot-toast";

// ── Badges ───────────────────────────────────────────────────────────────────

function SignalBadge({ signal }) {
  const s = (signal || "").toLowerCase();
  const isBull = s === "bullish";
  const isBear = s === "bearish";
  const cls = isBull
    ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
    : isBear
    ? "text-rose-400 bg-rose-400/10 border-rose-400/20"
    : "text-[#555555] bg-[#111111] border-[#222222]";
  const Icon = isBull ? TrendingUp : isBear ? TrendingDown : Minus;

  return (
    <span className={`inline-flex items-center gap-1 rounded-xl border font-bold uppercase tracking-wider px-2 py-0.5 text-[10px] ${cls}`}>
      <Icon size={10} />
      {signal || "Neutral"}
    </span>
  );
}

function ConfidenceBadge({ confidence }) {
  const c = (confidence || "").toLowerCase();
  const cls =
    c === "high"
      ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
      : c === "medium"
      ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
      : "text-[#555555] bg-[#1a1a1a] border-[#222222]";
  return (
    <span className={`inline-flex items-center rounded-xl border font-semibold uppercase tracking-wider px-2 py-0.5 text-[10px] ${cls}`}>
      {confidence || "Low"}
    </span>
  );
}

function FinBERTBadge({ label }) {
  const l = (label || "").toLowerCase();
  const cls =
    l === "positive"
      ? "text-emerald-400"
      : l === "negative"
      ? "text-rose-400"
      : "text-[#555555]";
  return (
    <span className={`font-semibold capitalize text-xs ${cls}`}>
      {label || "neutral"}
    </span>
  );
}

function VaderScore({ value }) {
  const v = value ?? 0;
  const cls = v > 0 ? "text-emerald-400" : v < 0 ? "text-rose-400" : "text-[#555555]";
  return (
    <span className={`font-mono text-xs ${cls}`}>
      {v > 0 ? "+" : ""}{v.toFixed(3)}
    </span>
  );
}

// ── Explanation Modal ────────────────────────────────────────────────────────

function SentimentModal({ article, onClose }) {
  if (!article) return null;

  const signalColor =
    article.signal === "Bullish"
      ? "text-emerald-400"
      : article.signal === "Bearish"
      ? "text-rose-400"
      : "text-[#777777]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[#222222] bg-[#0a0a0a] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#222222] bg-[#111111] px-6 py-4">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-blue-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              AI Sentiment Analysis
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-[#1a1a1a] p-1.5 text-[#555555] hover:bg-[#222222] hover:text-white transition"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Headline */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-[#555555] mb-1.5">
              Headline
            </p>
            <p className="text-sm font-semibold text-white leading-snug">
              {article.headline}
            </p>
            {article.source && (
              <p className="text-[11px] text-[#555555] mt-1">{article.source}</p>
            )}
          </div>

          {/* Signal + Confidence row */}
          <div className="grid grid-cols-2 gap-4 border-t border-b border-[#1a1a1a] py-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-[#555555] mb-2">
                Signal
              </p>
              <SignalBadge signal={article.signal} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-[#555555] mb-2">
                Confidence
              </p>
              <ConfidenceBadge confidence={article.confidence} />
            </div>
          </div>

          {/* Model breakdown */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-[#111111] border border-[#1a1a1a] p-3">
              <p className="text-[10px] uppercase tracking-widest text-[#555555] mb-1">FinBERT</p>
              <p className="text-sm font-bold capitalize" style={{
                color: article.finbert_label === "positive" ? "#34d399"
                     : article.finbert_label === "negative" ? "#f87171"
                     : "#555555"
              }}>
                {article.finbert_label}
              </p>
              <p className="text-[11px] text-[#555555] mt-0.5">
                {article.finbert_score !== undefined
                  ? `${(article.finbert_score * 100).toFixed(1)}% confidence`
                  : "—"}
              </p>
            </div>
            <div className="rounded-xl bg-[#111111] border border-[#1a1a1a] p-3">
              <p className="text-[10px] uppercase tracking-widest text-[#555555] mb-1">VADER</p>
              <p className={`text-sm font-bold font-mono ${
                (article.vader_compound ?? 0) > 0 ? "text-emerald-400"
                : (article.vader_compound ?? 0) < 0 ? "text-rose-400"
                : "text-[#555555]"
              }`}>
                {article.vader_compound !== undefined
                  ? `${article.vader_compound > 0 ? "+" : ""}${article.vader_compound.toFixed(3)}`
                  : "—"}
              </p>
              <p className="text-[11px] text-[#555555] mt-0.5">compound polarity</p>
            </div>
          </div>

          {/* Explanation */}
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
            <h3 className="text-[10px] uppercase tracking-widest text-blue-400 font-bold flex items-center gap-1.5 mb-2">
              <AlertCircle size={11} />
              Why this signal?
            </h3>
            <p className="text-sm text-blue-100 leading-relaxed">
              {article.explanation || "No explanation available."}
            </p>
          </div>

          {/* Source link */}
          {article.url && (
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-[11px] text-[#555555] hover:text-white transition underline underline-offset-2"
            >
              Read full article ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SentimentLab() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [selected, setSelected] = useState(null);
  const [marketSentiment, setMarketSentiment] = useState(null);

  const fetchArticles = async () => {
    setLoading(true);
    setFetchError(false);
    setOffline(false);
    try {
      console.log("Fetching sentiment data...");
      const res = await axios.get("http://127.0.0.1:8000/sentiment/news", {
        timeout: 120000, // 2 min — FinBERT analysis can be slow on first run
      });
      console.log("Sentiment response:", res.data);
      // Normalize: accept array directly OR wrapped {articles: [...], market_sentiment: ...}
      const raw = res.data;
      const normalizedArticles = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.articles)
        ? raw.articles
        : [];
      setArticles(normalizedArticles);
      setMarketSentiment(raw?.market_sentiment ?? null);
    } catch (error) {
      console.error("Sentiment fetch failed:", error);
      if (!error?.response) {
        setOffline(true);
      } else {
        setFetchError(true);
      }
      toast.error("Could not load sentiment data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  const overallSignal =
    marketSentiment > 0.30
      ? "Bullish"
      : marketSentiment < -0.30
      ? "Bearish"
      : "Neutral";

  return (
    <PageTransition>
      <div className="min-h-[calc(100vh-64px)] bg-[#050505] p-4 md:p-8">
        <div className="mx-auto max-w-6xl space-y-6">

          {/* ── Header ── */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Activity size={18} className="text-[#555555]" />
                <h1 className="text-2xl font-black tracking-tight text-white">
                  Sentiment Lab
                </h1>
              </div>
              <p className="text-sm text-[#555555]">
                Financial news analyzed by FinBERT &amp; VADER · click any row for full breakdown
              </p>
            </div>
            <div className="flex items-center gap-3">
              {marketSentiment !== null && (
                <div className="flex items-center gap-2 rounded-xl border border-[#222222] bg-[#111111] px-4 py-2">
                  <span className="text-[10px] uppercase tracking-widest text-[#555555]">
                    Market
                  </span>
                  <SignalBadge signal={overallSignal} />
                </div>
              )}
              <button
                onClick={fetchArticles}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl border border-[#222222] bg-[#111111] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#1a1a1a] disabled:opacity-50"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>
          </div>

          {offline && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-400">
              Backend server unreachable. Make sure the backend is running on port 8000.
            </div>
          )}

          {/* ── Table ── */}
          <div className="rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-white border-collapse">
                <thead className="bg-[#111111] text-[#777777] text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-4 font-medium border-b border-[#222222] whitespace-nowrap">Time</th>
                    <th className="px-5 py-4 font-medium border-b border-[#222222] whitespace-nowrap">Source</th>
                    <th className="px-5 py-4 font-medium border-b border-[#222222] w-1/2">Headline</th>
                    <th className="px-5 py-4 font-medium border-b border-[#222222] text-center whitespace-nowrap">FinBERT</th>
                    <th className="px-5 py-4 font-medium border-b border-[#222222] text-center whitespace-nowrap">VADER</th>
                    <th className="px-5 py-4 font-medium border-b border-[#222222] text-center whitespace-nowrap">Signal</th>
                    <th className="px-5 py-4 font-medium border-b border-[#222222] text-center whitespace-nowrap">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a1a]">
                  {loading && articles.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-16 text-center text-[#555555]">
                        <RefreshCw size={24} className="animate-spin mx-auto mb-3 opacity-50" />
                        <p className="text-xs uppercase tracking-widest">
                          Running FinBERT + VADER analysis… (this may take 30–60s)
                        </p>
                      </td>
                    </tr>
                  ) : fetchError ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-16 text-center text-red-400 text-sm">
                        Failed to load sentiment data
                      </td>
                    </tr>
                  ) : articles.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-16 text-center text-[#555555]">
                        No market news found.
                      </td>
                    </tr>
                  ) : (
                    articles.map((article, i) => (
                      <tr
                        key={i}
                        onClick={() => setSelected(article)}
                        className="hover:bg-[#111111] transition cursor-pointer group"
                      >
                        <td className="px-5 py-4 whitespace-nowrap text-[#777777] group-hover:text-white transition text-xs">
                          {article.time
                            ? new Date(article.time).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap font-bold text-xs text-[#a0a0a0] group-hover:text-white transition">
                          {article.source || "—"}
                        </td>
                        <td className="px-5 py-4 font-medium text-[#d0d0d0] group-hover:text-white transition">
                          <div className="line-clamp-2 text-sm">{article.headline}</div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-center">
                          <FinBERTBadge label={article.finbert_label} />
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-center">
                          <VaderScore value={article.vader_compound} />
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-center">
                          <SignalBadge signal={article.signal} />
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-center">
                          <ConfidenceBadge confidence={article.confidence} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-center text-[10px] uppercase tracking-widest text-[#333333]">
            FinBERT: ProsusAI/finbert · VADER: Valence Aware Dictionary · Combined: 65% FinBERT + 35% VADER
          </p>
        </div>
      </div>

      <SentimentModal article={selected} onClose={() => setSelected(null)} />
    </PageTransition>
  );
}
