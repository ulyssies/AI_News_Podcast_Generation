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
    accent:
      "bg-gradient-to-br from-[#2a0d0d] to-[#1a0808] border border-red-950/35 hover:border-red-900/45",
    iconGlow: "text-red-400",
  },
  {
    key: "financial_report",
    label: "Financial Report",
    description: "Markets, earnings, and economic trends",
    iconId: "trending-up" as const,
    accent:
      "bg-gradient-to-br from-[#0d1f0d] to-[#081308] border border-emerald-950/30 hover:border-emerald-900/42",
    iconGlow: "text-emerald-400",
  },
  {
    key: "science",
    label: "Latest in Science",
    description: "Discoveries, research, and breakthroughs",
    iconId: "microscope" as const,
    accent:
      "bg-gradient-to-br from-[#0d1020] to-[#070a14] border border-blue-950/35 hover:border-blue-900/45",
    iconGlow: "text-sky-400",
  },
  {
    key: "sports",
    label: "Sports",
    description: "Scores, highlights, and headlines",
    iconId: "trophy" as const,
    accent:
      "bg-gradient-to-br from-[#1f1000] to-[#120900] border border-orange-950/28 hover:border-orange-900/38",
    iconGlow: "text-orange-400",
  },
  {
    key: "entertainment",
    label: "Entertainment",
    description: "Movies, music, culture, and celebrity news",
    iconId: "clapperboard" as const,
    accent:
      "bg-gradient-to-br from-[#1a0d2e] to-[#10081c] border border-violet-950/32 hover:border-violet-900/42",
    iconGlow: "text-purple-400",
  },
  {
    key: "tech_ai",
    label: "Tech & AI",
    description: "The latest in technology and artificial intelligence",
    iconId: "cpu" as const,
    accent:
      "bg-gradient-to-br from-[#0d1f1f] to-[#081212] border border-teal-950/30 hover:border-teal-900/40",
    iconGlow: "text-cyan-400",
  },
  {
    key: "health_wellness",
    label: "Health & Wellness",
    description: "Medical news, wellness tips, and research",
    iconId: "heart" as const,
    accent:
      "bg-gradient-to-br from-[#0d1a0d] to-[#081008] border border-green-950/30 hover:border-green-900/40",
    iconGlow: "text-green-400",
  },
  {
    key: "politics",
    label: "Politics",
    description: "Balanced coverage, all sides, no spin",
    iconId: "scale" as const,
    accent:
      "bg-gradient-to-br from-[#1a1a1a] to-[#111111] border border-zinc-600/35 hover:border-zinc-500/45",
    iconGlow: "text-zinc-300",
  },
] as const;

export type CategoryKey = (typeof BRIEFING_CATEGORIES)[number]["key"];
