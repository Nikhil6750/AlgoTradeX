import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";

const SPEED_OPTIONS = [1, 2, 5, 10];

export default function ReplayControls({
    isPlaying,
    speed,
    cursor,
    totalCandles,
    canStep,
    onPlay,
    onPause,
    onStep,
    onReset,
    onSpeedChange,
}) {
    return (
        <div
            className="flex flex-col gap-4 rounded-2xl border border-[#222222] bg-[#111111] px-5 py-4"
        >
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onPlay}
                        disabled={!canStep}
                        className="flex items-center gap-2 rounded-xl border border-[#222222] bg-[#111111] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#161616] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <Play size={16} />
                        Play
                    </button>
                    <button
                        type="button"
                        onClick={onPause}
                        disabled={!isPlaying}
                        className="flex items-center gap-2 rounded-xl border border-[#222222] bg-[#111111] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#161616] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <Pause size={16} />
                        Pause
                    </button>
                    <button
                        type="button"
                        onClick={onStep}
                        disabled={!canStep}
                        className="flex items-center gap-2 rounded-xl border border-[#222222] bg-[#111111] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#161616] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <SkipForward size={16} />
                        Next Candle
                    </button>
                    <button
                        type="button"
                        onClick={onReset}
                        className="flex items-center gap-2 rounded-xl border border-[#222222] bg-[#111111] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#161616]"
                    >
                        <RotateCcw size={15} />
                        Reset
                    </button>
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-[#222222] bg-[#111111] p-1">
                    {SPEED_OPTIONS.map((option) => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => onSpeedChange(option)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                                speed === option
                                    ? "bg-black text-white"
                                    : "text-[#a0a0a0] hover:bg-[#161616] hover:text-white"
                            }`}
                        >
                            {option}x
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[#a0a0a0]">
                    <span>Replay progress</span>
                    <span>{Math.min(cursor + 1, totalCandles)} / {totalCandles}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                        className="h-full rounded-full bg-white transition-[width] duration-150"
                        style={{
                            width: totalCandles > 0 ? `${((cursor + 1) / totalCandles) * 100}%` : "0%",
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
