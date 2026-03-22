import { Pause, Play, SkipBack, SkipForward } from "lucide-react";

const SPEEDS = [
  { label: "0.5×", value: 500 },
  { label: "1×",   value: 250 },
  { label: "2×",   value: 125 },
  { label: "4×",   value: 60  },
];

export default function ReplayControls({
  total = 0,
  index = 0,
  playing = false,
  speed = 250,
  onPlay,
  onPause,
  onStep,
  onSpeedChange,
  onReset,
}) {
  const progress = total > 0 ? Math.round((index / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#222222] bg-[#0a0a0a] px-5 py-4">
      {/* Top row: controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {/* Reset / step back */}
          <button
            type="button"
            onClick={() => onStep(-1)}
            disabled={index <= 0}
            title="Step back"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#222222] bg-[#111111] text-[#a0a0a0] transition hover:text-white disabled:opacity-30"
          >
            <SkipBack size={14} />
          </button>

          {/* Play / Pause */}
          <button
            type="button"
            onClick={playing ? onPause : onPlay}
            disabled={index >= total}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black transition hover:bg-[#e0e0e0] disabled:bg-[#333333] disabled:text-[#666666]"
          >
            {playing ? <Pause size={15} /> : <Play size={15} />}
          </button>

          {/* Step forward */}
          <button
            type="button"
            onClick={() => onStep(1)}
            disabled={index >= total}
            title="Step forward"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#222222] bg-[#111111] text-[#a0a0a0] transition hover:text-white disabled:opacity-30"
          >
            <SkipForward size={14} />
          </button>
        </div>

        {/* Candle counter */}
        <span className="text-[11px] font-medium tabular-nums text-[#555555]">
          {index} / {total} candles
        </span>

        {/* Speed selector */}
        <div className="flex items-center gap-1 rounded-xl border border-[#222222] bg-[#111111] p-1">
          {SPEEDS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => onSpeedChange(s.value)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                speed === s.value
                  ? "bg-white text-black"
                  : "text-[#555555] hover:text-white"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full rounded-full bg-[#222222]">
        <div
          className="h-full rounded-full bg-white transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
