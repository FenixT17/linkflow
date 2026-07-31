export interface DailyStat {
  day: string;
  views: number;
  clicks: number;
}

export function updateDailyStats(
  dailyStats: DailyStat[],
  type: "views" | "clicks"
): DailyStat[] {
  const today = new Date().toISOString().split("T")[0];
  const index = dailyStats.findIndex((s) => s.day === today);
  if (index >= 0) {
    return dailyStats.map((s, i) =>
      i === index ? { ...s, [type]: (s[type] ?? 0) + 1 } : s
    );
  }
  return [
    ...dailyStats,
    {
      day: today,
      views: type === "views" ? 1 : 0,
      clicks: type === "clicks" ? 1 : 0,
    },
  ];
}
