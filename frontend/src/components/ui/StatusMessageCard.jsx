export default function StatusMessageCard({
    title,
    description,
    actionLabel = "",
    onAction,
    tone = "warning",
    className = "",
}) {
    let palette = "border-[#222222] bg-[#111111] text-[#ffffff]";
    if (tone === "error") {
        palette = "border-[#222222] bg-[#111111] text-[#ffffff]";
    } else if (tone === "neutral") {
        palette = "border-[#222222] bg-[#111111] text-[#ffffff]";
    }

    return (
        <div className={`rounded-[12px] border px-5 py-4 ${palette} ${className}`.trim()}>
            <div className="space-y-1">
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-xs leading-5 text-[#a0a0a0]">{description}</p>
            </div>
            {actionLabel && onAction && (
                <button
                    type="button"
                    onClick={onAction}
                    className="mt-4 rounded-xl border border-[#222222] bg-[#111111] px-3 py-2 text-xs font-semibold text-[#ffffff] transition hover:bg-[#161616]"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
}
