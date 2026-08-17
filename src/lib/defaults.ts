import { Appearance, AnalyticsData, UserSettings } from "./types";

/**
 * Aparência padrão — Liquid Glass exclusivo.
 * Sem temas, sem variações. Apenas Liquid Glass.
 */
export function defaultAppearance(): Appearance {
  return {
    desfoco: 25,
    arredondado: 16,
    opacidadeLinks: 100,
    corFundo: "#0a0a0a",
    corCartao: "rgba(255,255,255,0.03)",
    corTexto: "#fafafa",
    corDestaque: "#fafafa",
    familiaFonte: "Inter",
    tamanhoFonte: 16,
    raioBotao: 12,
    larguraBotao: "full",
    alturaBotao: "normal",
    estiloBotao: "glass",
    sombra: "md",
    mostrarAvatar: true,
    mostrarBiografia: true,
    mostrarSocial: true,
    espacamento: 6,
    opacidadeVidro: 35,
    desfocoVidro: 25,
    intensidadeVidro: 50,
  };
}

export function emptyAnalytics(): AnalyticsData {
  return {
    visualizacoes: 0,
    cliques: 0,
    ctr: 0,
    seguidores: 0,
    uniqueVisitors: 0,
    visitorGrowth: 0,
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
