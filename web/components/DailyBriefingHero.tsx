import { Radio, Zap } from "lucide-react";

type Length = "short" | "medium" | "long";

type DailyBriefingHeroProps = {
  length: Length;
  onLengthChange: (l: Length) => void;
  onGenerate: () => void;
  loading: boolean;
  isFullBriefingActive: boolean;
  progress: number;
  loadingMessage: string;
  audioLevels?: number[];
  audioReactive?: boolean;
};

const RESTING_WAVEFORM_LEVELS = [0.26, 0.5, 0.64, 0.36, 0.22, 0.19, 0.14];

export function DailyBriefingHero({
  length,
  onLengthChange,
  onGenerate,
  loading,
  isFullBriefingActive,
  progress,
  loadingMessage,
  audioLevels,
  audioReactive = false,
}: DailyBriefingHeroProps) {
  const waveformLevels =
    audioLevels && audioLevels.length > 0 ? audioLevels : RESTING_WAVEFORM_LEVELS;

  return (
    <section className="relative w-full overflow-hidden rounded-[8px] border border-white/10 shadow-2xl shadow-black/50">
      {/* Background layers */}
      <div className="absolute inset-0 bg-[#08080b]" aria-hidden />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_85%_70%_at_18%_18%,rgba(99,102,241,0.18),transparent_50%)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[linear-gradient(165deg,rgba(255,255,255,0.07)_0%,transparent_34%,rgba(20,184,166,0.08)_100%)]"
        aria-hidden
      />
      <div className="hero-card-sheen absolute inset-0" aria-hidden />

      {/* Content */}
      <div className="relative px-5 py-5 xl:px-7 xl:py-6">
        <div className="flex flex-col gap-2.5">

          {/* Eyebrow */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-indigo-400/25 bg-indigo-400/10 text-indigo-200">
                <Radio className="h-3.5 w-3.5" aria-hidden />
              </span>
              <p className="text-[9px] font-semibold uppercase text-zinc-400 leading-none">
                Today&apos;s Full Briefing
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/15 bg-emerald-300/10 px-2 py-1 text-[9px] font-semibold uppercase text-emerald-100">
              <Zap className="h-3 w-3" aria-hidden />
              Live
            </span>
          </div>

          {/* Headline */}
          <h2 className="font-display font-extrabold tracking-normal text-white leading-[0.98] text-[1.85rem] sm:text-[2.35rem] md:text-[1.75rem] lg:text-[1.95rem] xl:text-[2.35rem] 2xl:text-[2.7rem]">
            Everything you need<br className="hidden sm:block" /> to know today.
          </h2>

          {/* Description — hidden on desktop where column is narrow */}
          <p className="text-[11px] text-zinc-500 leading-relaxed lg:hidden">
            No fluff, no spin - one rundown across every section.
          </p>

          <div className="flex h-8 items-end gap-1.5" aria-hidden>
            {waveformLevels.map((level, bar) => (
              <span
                key={bar}
                className={`w-1.5 rounded-full bg-indigo-300/70 ${
                  audioReactive ? "transition-[height,opacity] duration-75 ease-linear" : "audio-wave-bar"
                }`}
                style={{
                  height: audioReactive
                    ? `${Math.max(5, Math.round(level * 30))}px`
                    : `${10 + ((bar * 7) % 20)}px`,
                  opacity: audioReactive ? 0.42 + level * 0.58 : undefined,
                  animationDelay: audioReactive ? undefined : `${bar * 85}ms`,
                }}
              />
            ))}
          </div>

          {/* Length picker */}
          <div className="space-y-1.5">
            <span className="text-[9px] font-medium uppercase text-zinc-500">
              Episode length
            </span>
            <div id="length-pills" className="flex gap-1.5">
              {(
                [
                  ["short", "Short", "~5m"],
                  ["medium", "Medium", "~15m"],
                  ["long", "Long", "~30m"],
                ] as const
              ).map(([opt, label, hint]) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onLengthChange(opt)}
                  disabled={loading}
                  className={`rounded-full px-3 py-1.5 text-[10px] font-medium whitespace-nowrap transition-all duration-150 leading-none ${
                    length === opt
                      ? "bg-white text-black border border-white"
                      : "bg-white/[0.04] text-[#777777] border border-white/10 hover:border-white/25 hover:text-[#d8d8d8]"
                  } disabled:opacity-40`}
                >
                  <span>{label}</span>
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
            className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-[8px] bg-[#6366f1] text-white px-6 py-2.5 xl:py-3 text-[11px] font-semibold border border-[#818cf8]/40 transition-all duration-200 hover:bg-[#7477ff] hover:shadow-[0_0_26px_rgba(99,102,241,0.24)] active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Radio className="h-3.5 w-3.5" aria-hidden />
            {isFullBriefingActive
              ? `${loadingMessage} ${progress}%`
              : loading
                ? "Briefing in progress…"
                : "Generate briefing"}
          </button>
        </div>
      </div>
    </section>
  );
}
