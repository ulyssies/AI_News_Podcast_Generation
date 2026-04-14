import {
  Clapperboard,
  Cpu,
  Globe,
  Heart,
  Microscope,
  Scale,
  Trophy,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { BRIEFING_CATEGORIES, type CategoryIconId } from "../lib/categories";

const CATEGORY_ICONS: Record<CategoryIconId, LucideIcon> = {
  globe: Globe,
  "trending-up": TrendingUp,
  microscope: Microscope,
  trophy: Trophy,
  clapperboard: Clapperboard,
  cpu: Cpu,
  heart: Heart,
  scale: Scale,
};

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
    <section className={compact ? "mt-4" : "mt-6 sm:mt-8"}>
      <div className={`flex items-baseline justify-between gap-2 ${compact ? "mb-2" : "mb-3 sm:mb-4"}`}>
        <h2 className={`font-display font-bold text-white tracking-tight ${compact ? "text-xs" : "text-sm"}`}>
          Go deeper
        </h2>
        <span className="text-[10px] text-slate-500 whitespace-nowrap">~10 min each</span>
      </div>

      <div
        className={
          compact
            ? "grid grid-cols-2 gap-1.5"
            : "grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4"
        }
      >
        {BRIEFING_CATEGORIES.map((cat) => {
          const busy = loading && loadingCategory === cat.key;
          const Icon = CATEGORY_ICONS[cat.iconId];

          return (
            <button
              key={cat.key}
              type="button"
              disabled={loading}
              onClick={() => onSelectCategory(cat.key, cat.label)}
              style={{
                background: cat.cardBg,
                borderColor: cat.borderColor,
              }}
              className={`group relative flex flex-col text-left rounded-xl border overflow-hidden transition-all duration-200 hover:scale-[1.025] hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-white/25 ${
                compact ? "aspect-[5/2]" : "aspect-[3/2]"
              }`}
            >
              {/* Vignette */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(ellipse at 50% 0%, transparent 40%, rgba(0,0,0,0.55) 100%)",
                }}
              />

              {/* Icon */}
              <div className={`relative flex-1 flex items-center justify-center ${compact ? "pt-1.5 pb-0" : "pt-3 pb-1"}`}>
                <Icon
                  style={{ color: cat.iconColor }}
                  className={`shrink-0 drop-shadow-[0_0_12px_currentColor] transition-transform duration-200 group-hover:scale-110 ${
                    compact
                      ? "h-5 w-5 sm:h-6 sm:w-6"
                      : "h-9 w-9 sm:h-10 sm:w-10 lg:h-11 lg:w-11"
                  }`}
                  strokeWidth={1.3}
                  aria-hidden
                />
              </div>

              {/* Label */}
              <div className={`relative ${compact ? "px-2 pb-1.5" : "px-3 pb-3 pt-0"}`}>
                <p className={`font-semibold text-white leading-tight ${compact ? "text-[10px]" : "text-[11px] sm:text-xs"}`}>
                  {cat.label}
                </p>
                {!compact && (
                  <p className="mt-0.5 text-[9px] sm:text-[10px] text-white/45 leading-tight line-clamp-1 hidden sm:block">
                    {cat.description}
                  </p>
                )}
              </div>

              {/* Generating overlay */}
              {busy && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 rounded-xl backdrop-blur-[2px]">
                  <div className="h-5 w-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
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
