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
    cardBg: "radial-gradient(ellipse at 30% 25%, #7f1d1d 0%, #3b0a0a 55%, #050101 100%)",
    iconColor: "#fca5a5",
    borderColor: "rgba(239, 68, 68, 0.22)",
  },
  {
    key: "financial_report",
    label: "Financial Report",
    description: "Markets, earnings, and economic trends",
    iconId: "trending-up" as const,
    cardBg: "radial-gradient(ellipse at 30% 25%, #14532d 0%, #052e16 55%, #010802 100%)",
    iconColor: "#86efac",
    borderColor: "rgba(34, 197, 94, 0.22)",
  },
  {
    key: "science",
    label: "Latest in Science",
    description: "Discoveries, research, and breakthroughs",
    iconId: "microscope" as const,
    cardBg: "radial-gradient(ellipse at 30% 25%, #1e1b4b 0%, #0a0830 55%, #010108 100%)",
    iconColor: "#a5b4fc",
    borderColor: "rgba(99, 102, 241, 0.22)",
  },
  {
    key: "sports",
    label: "Sports",
    description: "Scores, highlights, and headlines",
    iconId: "trophy" as const,
    cardBg: "radial-gradient(ellipse at 30% 25%, #78350f 0%, #3c1503 55%, #080200 100%)",
    iconColor: "#fcd34d",
    borderColor: "rgba(245, 158, 11, 0.22)",
  },
  {
    key: "entertainment",
    label: "Entertainment",
    description: "Movies, music, culture, and celebrity news",
    iconId: "clapperboard" as const,
    cardBg: "radial-gradient(ellipse at 30% 25%, #581c87 0%, #2d0b53 55%, #060008 100%)",
    iconColor: "#e879f9",
    borderColor: "rgba(192, 38, 211, 0.22)",
  },
  {
    key: "tech_ai",
    label: "Tech & AI",
    description: "The latest in technology and artificial intelligence",
    iconId: "cpu" as const,
    cardBg: "radial-gradient(ellipse at 30% 25%, #0c4a6e 0%, #042a40 55%, #000608 100%)",
    iconColor: "#7dd3fc",
    borderColor: "rgba(14, 165, 233, 0.22)",
  },
  {
    key: "health_wellness",
    label: "Health & Wellness",
    description: "Medical news, wellness tips, and research",
    iconId: "heart" as const,
    cardBg: "radial-gradient(ellipse at 30% 25%, #134e4a 0%, #042f2d 55%, #000706 100%)",
    iconColor: "#5eead4",
    borderColor: "rgba(20, 184, 166, 0.22)",
  },
  {
    key: "politics",
    label: "Politics",
    description: "Balanced coverage, all sides, no spin",
    iconId: "scale" as const,
    cardBg: "radial-gradient(ellipse at 30% 25%, #1e3a5f 0%, #0f1f38 55%, #010305 100%)",
    iconColor: "#93c5fd",
    borderColor: "rgba(59, 130, 246, 0.22)",
  },
] as const;

export type CategoryKey = (typeof BRIEFING_CATEGORIES)[number]["key"];
