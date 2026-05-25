/** Curated briefing categories — keys must match API `category` values. */
export const BRIEFING_CATEGORIES = [
  {
    key: "current_events",
    label: "Current Events",
    coverSrc: "/category-covers/current-events.svg",
    description: "Today's top stories from around the world",
    accentColor: "#fb7185",
    borderColor: "rgba(252, 165, 165, 0.24)",
  },
  {
    key: "financial_report",
    label: "Financial Report",
    coverSrc: "/category-covers/financial-report.svg",
    description: "Markets, earnings, and economic trends",
    accentColor: "#86efac",
    borderColor: "rgba(134, 239, 172, 0.24)",
  },
  {
    key: "science",
    label: "Latest in Science",
    coverSrc: "/category-covers/science.svg",
    description: "Discoveries, research, and breakthroughs",
    accentColor: "#93b4ff",
    borderColor: "rgba(165, 180, 252, 0.24)",
  },
  {
    key: "sports",
    label: "Sports",
    coverSrc: "/category-covers/sports.svg",
    description: "Scores, highlights, and headlines",
    accentColor: "#f97316",
    borderColor: "rgba(251, 146, 60, 0.24)",
  },
  {
    key: "entertainment",
    label: "Entertainment",
    coverSrc: "/category-covers/entertainment.svg",
    description: "Movies, music, culture, and celebrity news",
    accentColor: "#e879f9",
    borderColor: "rgba(232, 121, 249, 0.24)",
  },
  {
    key: "tech_ai",
    label: "Tech & AI",
    coverSrc: "/category-covers/tech-ai.svg",
    description: "The latest in technology and artificial intelligence",
    accentColor: "#67e8f9",
    borderColor: "rgba(125, 211, 252, 0.24)",
  },
  {
    key: "health_wellness",
    label: "Health & Wellness",
    coverSrc: "/category-covers/health-wellness.svg",
    description: "Medical news, wellness tips, and research",
    accentColor: "#84cc16",
    borderColor: "rgba(132, 204, 22, 0.24)",
  },
  {
    key: "politics",
    label: "Politics",
    coverSrc: "/category-covers/politics.svg",
    description: "Balanced coverage, all sides, no spin",
    accentColor: "#818cf8",
    borderColor: "rgba(99, 102, 241, 0.24)",
  },
] as const;

export type CategoryKey = (typeof BRIEFING_CATEGORIES)[number]["key"];
