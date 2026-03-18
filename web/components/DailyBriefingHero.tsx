import { HeroGlobeBroadcast } from "./HeroGlobeBroadcast";

type Length = "short" | "medium" | "long";

type DailyBriefingHeroProps = {
  length: Length;
  onLengthChange: (l: Length) => void;
  onGenerate: () => void;
  loading: boolean;
  isFullBriefingActive: boolean;
  progress: number;
  audioPlaying: boolean;
};

export function DailyBriefingHero({
  length,
  onLengthChange,
  onGenerate,
  loading,
  isFullBriefingActive,
  progress,
  audioPlaying,
}: DailyBriefingHeroProps) {
  return (
    <section className="relative w-full overflow-hidden rounded-2xl border border-zinc-800/60 shadow-lg shadow-black/40">
      {/* OLED-adjacent black with subtle graphite depth vs page (#050508) */}
      <div
        className="absolute inset-0 bg-[#0a0a0a]"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_85%_70%_at_20%_30%,rgba(38,38,42,0.45),transparent_55%)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[linear-gradient(165deg,rgba(28,28,30,0.35)_0%,transparent_45%,rgba(18,18,20,0.25)_100%)]"
        aria-hidden
      />
      <div
        className="absolute inset-y-0 right-0 w-[45%] max-w-[440px] min-w-[260px] hidden md:block bg-[linear-gradient(to_left,rgba(14,14,16,0.95)_0%,transparent_100%)] pointer-events-none rounded-r-2xl"
        aria-hidden
      />

      <div className="relative flex flex-col md:flex-row md:items-center md:min-h-[260px] lg:min-h-[280px] xl:min-h-[320px] 2xl:min-h-[340px] min-h-0">
        <div className="min-w-0 flex-1 z-10 px-3 py-3 sm:px-4 sm:py-3 md:py-5 md:pl-5 md:pr-3 md:w-[58%] md:flex-none md:flex md:flex-col md:justify-center">
          <div className="flex flex-col gap-2 md:gap-2.5 max-w-xl">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500 leading-none">
              Today&apos;s Full Briefing
            </p>
            <h1 className="text-lg sm:text-xl md:text-2xl xl:text-3xl font-bold tracking-tight text-white leading-tight">
              Everything you need to know today.
            </h1>
            <p className="text-[11px] sm:text-xs xl:text-sm text-zinc-500 leading-snug">
              No fluff, no spin — one rundown across every section.
            </p>

            <div className="space-y-1 pt-0.5">
              <span className="text-[9px] xl:text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                Length
              </span>
              <div className="flex flex-wrap gap-1">
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
                    className={`rounded-md px-2 py-1 xl:px-2.5 xl:py-1.5 text-[10px] xl:text-[11px] font-medium transition-all leading-none ${
                      length === opt
                        ? "bg-zinc-200 text-zinc-900 ring-1 ring-zinc-400/30"
                        : "bg-zinc-900/80 text-zinc-500 border border-zinc-800 hover:bg-zinc-800/80 hover:text-zinc-300"
                    } disabled:opacity-50`}
                  >
                    <span className="capitalize">{opt}</span>
                    <span className="ml-0.5 opacity-75 font-normal">{hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={onGenerate}
              disabled={loading}
              className="mt-1 w-[min(100%,240px)] xl:w-[min(100%,260px)] shrink-0 rounded-full bg-white text-zinc-900 px-5 xl:px-6 py-2.5 xl:py-3 text-[11px] xl:text-xs font-semibold tracking-wide hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md self-start"
            >
              {isFullBriefingActive
                ? `Generating… ${progress}%`
                : loading
                  ? "Briefing in progress…"
                  : "Play today’s briefing"}
            </button>
          </div>
        </div>

        <div className="hidden md:block relative w-[42%] min-w-[320px] max-w-[520px] shrink-0 h-[260px] lg:h-[280px] xl:h-[320px] 2xl:h-[340px] overflow-hidden">
          <HeroGlobeBroadcast audioPlaying={audioPlaying} />
        </div>
      </div>
    </section>
  );
}
