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
};

export function CategoryBriefingGrid({
  onSelectCategory,
  loading,
  loadingCategory,
}: CategoryBriefingGridProps) {
  return (
    <section className="mt-1.5 sm:mt-2">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <h2 className="text-xs font-semibold text-white tracking-tight leading-none">
          Go deeper
        </h2>
        <span className="text-[9px] text-slate-500 whitespace-nowrap">~5 min each</span>
      </div>

      <div className="grid grid-cols-4 gap-2 lg:gap-3">
        {BRIEFING_CATEGORIES.map((cat) => {
          const busy = loading && loadingCategory === cat.key;
          const Icon = CATEGORY_ICONS[cat.iconId];
          return (
            <button
              key={cat.key}
              type="button"
              disabled={loading}
              onClick={() => onSelectCategory(cat.key, cat.label)}
              className={`group flex flex-col items-start text-left rounded-md border px-2 py-2 sm:px-2.5 sm:py-2.5 lg:px-3 lg:py-3 min-h-[4.625rem] sm:min-h-[4.875rem] lg:min-h-[5.25rem] transition-all duration-150 hover:brightness-[1.05] active:scale-[0.99] disabled:opacity-40 ${cat.accent}`}
            >
              <Icon
                className={`h-[19px] w-[19px] lg:h-[21px] lg:w-[21px] shrink-0 ${cat.iconGlow}`}
                strokeWidth={1.6}
                aria-hidden
              />
              <span className="mt-0.5 text-[9px] sm:text-[10px] lg:text-[11px] font-semibold text-white leading-[1.2] line-clamp-2">
                {cat.label}
              </span>
              <span className="mt-0.5 text-[8px] sm:text-[9px] lg:text-[10px] text-slate-400/85 leading-[1.25] line-clamp-2">
                {cat.description}
              </span>
              {busy && (
                <span className="mt-auto pt-0.5 text-[7px] font-medium text-slate-400/80">
                  Generating…
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
