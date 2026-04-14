type Length = "short" | "medium" | "long";

type DailyBriefingHeroProps = {
  length: Length;
  onLengthChange: (l: Length) => void;
  onGenerate: () => void;
  loading: boolean;
  isFullBriefingActive: boolean;
  progress: number;
};

export function DailyBriefingHero({
  length,
  onLengthChange,
  onGenerate,
  loading,
  isFullBriefingActive,
  progress,
}: DailyBriefingHeroProps) {
  return (
    <section className="relative w-full overflow-hidden rounded-2xl border border-zinc-800/60 shadow-xl shadow-black/50">
      {/* Background layers */}
      <div className="absolute inset-0 bg-[#0a0a0a]" aria-hidden />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_85%_70%_at_20%_30%,rgba(38,38,42,0.5),transparent_55%)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[linear-gradient(165deg,rgba(28,28,30,0.4)_0%,transparent_45%,rgba(18,18,20,0.3)_100%)]"
        aria-hidden
      />

      {/* Content */}
      <div className="relative px-5 py-5 xl:px-7 xl:py-6">
        <div className="flex flex-col gap-2.5">

          {/* Eyebrow */}
          <div className="flex items-center gap-2.5">
            <span className="inline-block h-px w-5 bg-zinc-600 shrink-0" />
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-zinc-500 leading-none">
              Today&apos;s Full Briefing
            </p>
          </div>

          {/* Headline */}
          <h2 className="font-display font-extrabold tracking-[-0.03em] text-white leading-[0.95] text-[2rem] sm:text-[2.5rem] md:text-[1.875rem] lg:text-[2rem] xl:text-[2.5rem] 2xl:text-[3rem]">
            Everything you need<br className="hidden sm:block" /> to know today.
          </h2>

          {/* Description — hidden on desktop where column is narrow */}
          <p className="text-[11px] text-zinc-500 leading-relaxed lg:hidden">
            No fluff, no spin — one rundown across every section.
          </p>

          {/* Length picker */}
          <div className="space-y-1.5">
            <span className="text-[9px] font-medium uppercase tracking-wider text-zinc-600">
              Episode length
            </span>
            <div id="length-pills" className="flex gap-1.5">
              {(
                [
                  ["short", "~5m"],
                  ["medium", "~15m"],
                  ["long", "~30m"],
                ] as const
              ).map(([opt, hint]) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onLengthChange(opt)}
                  disabled={loading}
                  className={`rounded-full px-4 py-1.5 text-[10px] font-medium whitespace-nowrap transition-all duration-150 leading-none ${
                    length === opt
                      ? "bg-[#1c1c1c] text-white border border-[#404040]"
                      : "bg-[#111111] text-[#555555] border border-[#1e1e1e] hover:border-[#333333] hover:text-[#888888]"
                  } disabled:opacity-40`}
                >
                  <span className="capitalize">{opt}</span>
                  <span className="ml-1 opacity-50 font-normal">{hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={onGenerate}
            disabled={loading}
            className="mt-1 w-full rounded-xl bg-[#0d0d1a] text-white px-6 py-2.5 xl:py-3 text-[11px] font-semibold tracking-wide border border-[#6366f1]/30 transition-all duration-200 hover:bg-[#12122a] hover:border-[#6366f1] hover:shadow-[0_0_18px_rgba(99,102,241,0.12)] active:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isFullBriefingActive
              ? `Generating… ${progress}%`
              : loading
                ? "Briefing in progress…"
                : "Play today's briefing"}
          </button>
        </div>
      </div>
    </section>
  );
}
