import { Appearance, AnalyticsData, UserSettings } from "./types";

/**
 * Aparência padrão — Liquid Glass exclusivo.
 * Sem temas, sem variações. Apenas Liquid Glass.
 */
export function defaultAppearance(): Appearance {
  return {
    blur: 25,
    rounded: 16,
    linkOpacity: 100,
    backgroundColor: "#0a0a0a",
    cardColor: "rgba(255,255,255,0.03)",
    textColor: "#fafafa",
    accentColor: "#fafafa",
    fontFamily: "Inter",
    fontSize: 16,
    buttonRadius: 12,
    buttonWidth: "full",
    buttonHeight: "normal",
    buttonStyle: "glass",
    shadow: "md",
    showAvatar: true,
    showBio: true,
    spacing: 6,
    glassOpacity: 35,
    glassBlur: 25,
    glassStrength: 50,
  };
}

export function emptyAnalytics(): AnalyticsData {
  return {
    views: 0,
    clicks: 0,
    ctr: 0,
    followers: 0,
    weeklyGrowth: 0,
    monthlyGrowth: 0,
    topLinks: [],
    topCountries: [],
    topDevices: [],
    recentVisitors: [],
    hourlyStats: [],
    dailyStats: [],
  };
}

export function defaultSettings(): UserSettings {
  return {
    weeklyEmail: true,
    newFollowerAlerts: false,
    language: "pt",
    timezone: "Europe/Lisbon",
  };
}
