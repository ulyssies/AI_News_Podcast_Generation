import type { CSSProperties } from "react";
import { BRIEFING_CATEGORIES } from "../lib/categories";

type CategoryBriefingGridProps = {
  onSelectCategory: (categoryKey: string, label: string) => void;
  loading: boolean;
  loadingCategory: string | null;
  /** Compact mode: 2-col fixed grid, flat aspect ratio, tighter spacing.
   *  Used when rendered inside a narrow fixed-height left column. */
  compact?: boolean;
};

export function CategoryBriefingGrid({
  onSelectCategory,
  loading,
  loadingCategory,
  compact = false,
}: CategoryBriefingGridProps) {
  return (
    <section className={compact ? "mt-5" : "mt-6 sm:mt-8"}>
      <div className={`flex items-baseline justify-between gap-2 ${compact ? "mb-4" : "mb-5 sm:mb-6"}`}>
        <h2 className={`font-sans font-extrabold text-white tracking-normal ${compact ? "text-[22px] leading-none" : "text-3xl leading-none"}`}>
          Go deeper
        </h2>
        <span className={`font-sans text-slate-500 whitespace-nowrap ${compact ? "text-sm" : "text-base"}`}>~10 min each</span>
      </div>

      <div
        className={
          compact
            ? "grid grid-cols-2 min-[760px]:grid-cols-4 gap-3"
            : "grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4"
        }
      >
        {BRIEFING_CATEGORIES.map((cat) => {
          const busy = loading && loadingCategory === cat.key;
          const artworkStyle = {
            borderColor: cat.borderColor,
            "--category-accent-color": cat.accentColor,
          } as CSSProperties;

          return (
            <button
              key={cat.key}
              type="button"
              disabled={loading}
              onClick={() => onSelectCategory(cat.key, cat.label)}
              style={artworkStyle}
              aria-label={`Generate ${cat.label} briefing`}
              className="category-card category-cover-card group relative flex aspect-square flex-col justify-end overflow-hidden rounded-[8px] border text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(0,0,0,0.32)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
            >
              <img
                src={cat.coverSrc}
                alt=""
                className="category-cover-image"
                draggable={false}
              />

              <p
                className="category-cover-title z-10 font-sans font-extrabold text-white tracking-normal drop-shadow-[0_2px_10px_rgba(0,0,0,0.72)]"
              >
                {cat.label}
              </p>

              {/* Generating overlay */}
              {busy && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/45 rounded-[8px] backdrop-blur-[2px]">
                  <div className="flex items-end gap-1" aria-hidden>
                    {[0, 1, 2].map((bar) => (
                      <span
                        key={bar}
                        className="audio-wave-bar w-1 rounded-full bg-white/80"
                        style={{ height: `${10 + bar * 4}px`, animationDelay: `${bar * 110}ms` }}
                      />
                    ))}
                  </div>
                  <span className="text-[9px] font-medium text-white/70">Generating…</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
