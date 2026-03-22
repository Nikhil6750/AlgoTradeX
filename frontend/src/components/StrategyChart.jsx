import { useEffect, useRef } from "react";
import { createChart, ColorType } from "lightweight-charts";

const CANDLES_BEFORE = 12;
const CANDLES_AFTER  = 8;

// Safely format raw candle to lightweight-charts shape
function formatCandle(c) {
  return {
    time: c.time ?? Math.floor(new Date(c.timestamp).getTime() / 1000),
    open:  Number(c.open),
    high:  Number(c.high),
    low:   Number(c.low),
    close: Number(c.close),
  };
}

export default function StrategyChart({
  candles   = [],
  signals   = [],
  selectedSetup = null,
}) {
  const containerRef = useRef(null);
  const chartRef     = useRef(null);
  const seriesRef    = useRef(null);

  // ── 1) Mount chart ONCE when the full candle array arrives ─────────────────
  //    Never destroy/recreate on setup selection — that's what caused the black screen.
  useEffect(() => {
    if (!containerRef.current || !candles || candles.length === 0) return;

    // Prevent double-init
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#111111" },
        textColor: "#D9D9D9",
      },
      grid: {
        vertLines: { color: "#1a1a1a" },
        horzLines: { color: "#1a1a1a" },
      },
      width:  containerRef.current.clientWidth,
      height: 360,
      crosshair: { mode: 0 },
      timeScale: { borderColor: "#222222", timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: "#222222", borderVisible: false, scaleMargins: { top: 0.1, bottom: 0.1 } },
      handleScroll: true,
      handleScale: true,
    });

    const series = chart.addCandlestickSeries({
      upColor:    "#10b981",
      downColor:  "#ef4444",
      borderVisible: false,
      wickUpColor:   "#10b981",
      wickDownColor: "#ef4444",
      priceLineVisible: true,
      lastValueVisible: true,
      priceFormat: { type: "price", precision: 5, minMove: 0.00001 },
    });

    // Load ALL candles initially so the chart has the full dataset
    const allData = candles
      .map(formatCandle)
      .filter((c) => Number.isFinite(c.time))
      .sort((a, b) => a.time - b.time)
      .filter((c, i, arr) => i === 0 || c.time !== arr[i - 1].time);

    series.setData(allData);
    chart.timeScale().fitContent();

    chartRef.current  = chart;
    seriesRef.current = series;

    const onResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current  = null;
        seriesRef.current = null;
      }
    };
  }, [candles]); // Only remount when an entirely new candle array arrives (new strategy run)

  // ── 2) Update visible window + markers when setup is selected ──────────────
  //    Calls series.setData() and setMarkers() — NO chart recreation needed.
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;

    if (!selectedSetup || !Number.isFinite(selectedSetup.time)) {
      // No setup selected → show full dataset with all signal markers
      const allData = candles
        .map(formatCandle)
        .filter((c) => Number.isFinite(c.time))
        .sort((a, b) => a.time - b.time)
        .filter((c, i, arr) => i === 0 || c.time !== arr[i - 1].time);
      seriesRef.current.setData(allData);

      const baseMarkers = (signals || [])
        .map((s) => {
          const t     = s.time ?? Math.floor(new Date(s.timestamp).getTime() / 1000);
          const isBuy = String(s.type).toUpperCase() === "BUY";
          return {
            time:     t,
            position: isBuy ? "belowBar" : "aboveBar",
            color:    isBuy ? "#22c55e"  : "#ef4444",
            shape:    isBuy ? "arrowUp"  : "arrowDown",
            text:     isBuy ? "BUY"      : "SELL",
          };
        })
        .filter((m) => Number.isFinite(m.time))
        .sort((a, b) => a.time - b.time)
        .filter((m, i, arr) => i === 0 || m.time !== arr[i - 1].time);
      seriesRef.current.setMarkers(baseMarkers);
      chartRef.current.timeScale().fitContent();
      return;
    }

    // ── Setup selected: slice candles by index (consistent across timeframes) ──
    const signalIndex = candles.findIndex((c) => c.time === selectedSetup.time);

    let focusedData;
    if (signalIndex === -1) {
      // Fallback: show whole dataset if signal not found in candles
      focusedData = candles.map(formatCandle).filter((c) => Number.isFinite(c.time)).sort((a, b) => a.time - b.time);
    } else {
      const start = Math.max(signalIndex - CANDLES_BEFORE, 0);
      const end   = Math.min(signalIndex + CANDLES_AFTER + 1, candles.length);
      focusedData = candles
        .slice(start, end)
        .map(formatCandle)
        .filter((c) => Number.isFinite(c.time))
        .sort((a, b) => a.time - b.time)
        .filter((c, i, arr) => i === 0 || c.time !== arr[i - 1].time);
    }

    seriesRef.current.setData(focusedData);

    // Single BUY/SELL marker — no overlays
    const isBuy = String(selectedSetup.type).toUpperCase() === "BUY";
    seriesRef.current.setMarkers([
      {
        time:     selectedSetup.time,
        position: isBuy ? "belowBar" : "aboveBar",
        color:    isBuy ? "#22c55e"  : "#ef4444",
        shape:    isBuy ? "arrowUp"  : "arrowDown",
        text:     isBuy ? "BUY"      : "SELL",
      },
    ]);

    chartRef.current.timeScale().fitContent();
  }, [selectedSetup, signals, candles]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!candles || candles.length === 0) {
    return (
      <div className="flex items-center justify-center h-[360px] text-[#555555] rounded-2xl border border-[#222222] bg-[#111111] text-sm tracking-widest uppercase">
        No chart data
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-[#222222] bg-[#111111] overflow-hidden">
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
