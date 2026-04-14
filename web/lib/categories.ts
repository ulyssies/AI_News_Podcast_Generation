/** Curated briefing categories — keys must match API `category` values. */
export type CategoryIconId =
  | "globe"
  | "trending-up"
  | "microscope"
  | "trophy"
  | "clapperboard"
  | "cpu"
  | "heart"
  | "scale";

export const BRIEFING_CATEGORIES = [
  {
    key: "current_events",
    label: "Current Events",
    description: "Today's top stories from around the world",
    iconId: "globe" as const,
    // ~35% red hue blended into #0a0a0a, fades to near-black by 70%
    cardBg: "radial-gradient(ellipse at 30% 25%, #370d0d 0%, #0a0a0a 70%)",
    iconColor: "#fca5a5",
    borderColor: "rgba(239, 68, 68, 0.10)",
  },
  {
    key: "financial_report",
    label: "Financial Report",
    description: "Markets, earnings, and economic trends",
    iconId: "trending-up" as const,
    cardBg: "radial-gradient(ellipse at 30% 25%, #0d2416 0%, #0a0a0a 70%)",
    iconColor: "#86efac",
    borderColor: "rgba(34, 197, 94, 0.10)",
  },
  {
    key: "science",
    label: "Latest in Science",
    description: "Discoveries, research, and breakthroughs",
    iconId: "microscope" as const,
    cardBg: "radial-gradient(ellipse at 30% 25%, #110f21 0%, #0a0a0a 70%)",
    iconColor: "#a5b4fc",
    borderColor: "rgba(99, 102, 241, 0.10)",
  },
  {
    key: "sports",
    label: "Sports",
    description: "Scores, highlights, and headlines",
    iconId: "trophy" as const,
    cardBg: "radial-gradient(ellipse at 30% 25%, #301810 0%, #0a0a0a 70%)",
    iconColor: "#fcd34d",
    borderColor: "rgba(245, 158, 11, 0.10)",
  },
  {
    key: "entertainment",
    label: "Entertainment",
    description: "Movies, music, culture, and celebrity news",
    iconId: "clapperboard" as const,
    cardBg: "radial-gradient(ellipse at 30% 25%, #251036 0%, #0a0a0a 70%)",
    iconColor: "#e879f9",
    borderColor: "rgba(192, 38, 211, 0.10)",
  },
  {
    key: "tech_ai",
    label: "Tech & AI",
    description: "The latest in technology and artificial intelligence",
    iconId: "cpu" as const,
    cardBg: "radial-gradient(ellipse at 30% 25%, #0b2030 0%, #0a0a0a 70%)",
    iconColor: "#7dd3fc",
    borderColor: "rgba(14, 165, 233, 0.10)",
  },
  {
    key: "health_wellness",
    label: "Health & Wellness",
    description: "Medical news, wellness tips, and research",
    iconId: "heart" as const,
    cardBg: "radial-gradient(ellipse at 30% 25%, #0d221f 0%, #0a0a0a 70%)",
    iconColor: "#5eead4",
    borderColor: "rgba(20, 184, 166, 0.10)",
  },
  {
    key: "politics",
    label: "Politics",
    description: "Balanced coverage, all sides, no spin",
    iconId: "scale" as const,
    cardBg: "radial-gradient(ellipse at 30% 25%, #111b28 0%, #0a0a0a 70%)",
    iconColor: "#93c5fd",
    borderColor: "rgba(59, 130, 246, 0.10)",
  },
] as const;

export type CategoryKey = (typeof BRIEFING_CATEGORIES)[number]["key"];
