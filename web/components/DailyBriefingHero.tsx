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
      {/* Fade globe into content on desktop */}
      <div
        className="absolute inset-y-0 right-0 w-[45%] max-w-[440px] min-w-[260px] hidden md:block bg-[linear-gradient(to_left,rgba(10,10,10,0.98)_0%,transparent_100%)] pointer-events-none rounded-r-2xl"
        aria-hidden
      />

      <div className="relative flex flex-col md:flex-row md:items-center md:min-h-[300px] lg:min-h-[330px] xl:min-h-[370px] 2xl:min-h-[400px] min-h-0">

        {/* Left — editorial content */}
        <div className="min-w-0 flex-1 z-10 px-6 py-8 sm:px-8 sm:py-10 md:py-12 md:pl-10 md:pr-4 xl:pl-14 xl:py-14 md:w-[58%] md:flex-none md:flex md:flex-col md:justify-center">
          <div className="flex flex-col gap-4 md:gap-5 max-w-lg">

            {/* Eyebrow — rule + label */}
            <div className="flex items-center gap-2.5">
              <span className="inline-block h-px w-5 bg-zinc-600 shrink-0" />
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-zinc-500 leading-none">
                Today&apos;s Full Briefing
              </p>
            </div>

            {/* Headline — Syne display, statement size */}
            <h2 className="font-display font-extrabold tracking-[-0.03em] text-white leading-[0.95] text-[2.75rem] sm:text-[3.5rem] md:text-[3rem] lg:text-[3.75rem] xl:text-[4.5rem] 2xl:text-[5.25rem]">
              Everything you need<br className="hidden sm:block" /> to know today.
            </h2>

            {/* Description */}
            <p className="text-[12px] sm:text-sm text-zinc-500 leading-relaxed max-w-xs">
              No fluff, no spin — one rundown across every section.
            </p>

            {/* Length picker */}
            <div className="space-y-2">
              <span className="text-[9px] font-medium uppercase tracking-wider text-zinc-600">
                Episode length
              </span>
              <div className="flex flex-wrap gap-1.5">
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
                    className={`rounded-full px-3 py-1.5 text-[10px] font-medium transition-all duration-200 leading-none ${
                      length === opt
                        ? "bg-zinc-200 text-zinc-900"
                        : "bg-zinc-900/80 text-zinc-500 border border-zinc-800 hover:bg-zinc-800 hover:text-zinc-300"
                    } disabled:opacity-50`}
                  >
                    <span className="capitalize">{opt}</span>
                    <span className="ml-1 opacity-55 font-normal">{hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* CTA — amber accent, pill, glow on hover */}
            <button
              type="button"
              onClick={onGenerate}
              disabled={loading}
              className="mt-2 w-[min(100%,240px)] xl:w-[min(100%,260px)] shrink-0 self-start rounded-full bg-[#6366f1] text-white px-6 py-3 xl:py-3.5 text-[11px] xl:text-xs font-semibold tracking-wide transition-all duration-300 hover:bg-[#5152d4] hover:shadow-[0_0_28px_rgba(99,102,241,0.4)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {isFullBriefingActive
                ? `Generating… ${progress}%`
                : loading
                  ? "Briefing in progress…"
                  : "Play today's briefing"}
            </button>
          </div>
        </div>

        {/* Right — globe, bleeds to card edges via section overflow-hidden */}
        <div className="hidden md:block relative w-[42%] min-w-[320px] max-w-[520px] shrink-0 h-[300px] lg:h-[330px] xl:h-[370px] 2xl:h-[400px]">
          <HeroGlobeBroadcast audioPlaying={audioPlaying} />
        </div>
      </div>
    </section>
  );
}
