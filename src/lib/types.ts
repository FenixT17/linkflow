export type LinkItemType =
  | "link"
  | "social"
  | "video"
  | "spotify"
  | "youtube"
  | "discord"
  | "tiktok"
  | "instagram"
  | "github"
  | "x"
  | "telegram"
  | "whatsapp"
  | "email"
  | "maps"
  | "calendar"
  | "pdf"
  | "image"
  | "gallery"
  | "custom";

export interface LinkItem {
  id: string;
  tipo: LinkItemType;
  titulo: string;
  descricao?: string;
  url: string;
  icone?: string;
  cor?: string;
  image?: string;
  animacao?: "fade" | "slide" | "scale" | "none";
  ativo: boolean;
  visivel: boolean;
  novaAba: boolean;
  ordem: number;
  cliques: number;
  agendadoPara?: string;
}

export type PageType =
  | "minimal"
  | "creator"
  | "business"
  | "store"
  | "portfolio"
  | "photographer"
  | "music"
  | "restaurant"
  | "event"
  | "resume"
  | "gamer"
  | "developer";

/**
 * Template de layout escolhido pelo utilizador na aba "Páginas".
 * Cada valor corresponde a um componente de layout completamente diferente.
 * O default para novos utilizadores é "template1".
 */
export type PageTemplateId = "template1" | "template2" | "template3";

export interface PageProfile {
  nomeUtilizador: string;
  nomeExibicao: string;
  biografia: string;
  avatar?: string;
  banner?: string;
  publicado: boolean;
  tipoPagina?: PageType;
  /** Template de layout escolhido na aba Páginas — controla o render público */
  modeloPagina?: PageTemplateId;
  /** Badges ativas da página (ex: ["verified", "supporter"]) */
  emblemas?: string[];
  publicacaoAgendadaEm?: string;
  despublicacaoAgendadaEm?: string;
}

export interface UserAccount {
  email: string;
  nomeExibicao: string;
  criadoEm: string;
  plano: PlanType;
  /** País do utilizador (recolhido por IP no registo) — ex: "Portugal" */
  pais?: string;
  /** Código ISO do país — ex: "PT" */
  codigoPais?: string;
  /** Moeda local do plano (ISO 4217) — ex: "EUR", "BRL" */
  moeda?: string;
}

export type PlanType = "free" | "pro" | "business" | "enterprise";

export interface Appearance {
  desfoco: number;
  arredondado: number;
  opacidadeLinks: number;
  corFundo?: string;
  corCartao?: string;
  corTexto?: string;
  corDestaque?: string;
  familiaFonte?: string;
  tamanhoFonte?: number;
  raioBotao?: number;
  larguraBotao?: "narrow" | "normal" | "wide" | "full";
  alturaBotao?: "compact" | "normal" | "tall";
  estiloBotao?: "solid" | "outline" | "soft" | "glass";
  sombra?: "none" | "sm" | "md" | "lg";
  mostrarAvatar: boolean;
  mostrarBiografia: boolean;
  /** Mostra secção de links sociais em destaque */
  mostrarSocial: boolean;
  espacamento: number;
  /** Glass-specific: cor da borda das barras (suportada em temas antigos) */
  borderColor?: string;
  /** Glass-specific: espessura da borda em pixels (suportada em temas antigos) */
  borderWidth?: number;
  /** Liquid Glass: opacidade global do vidro (0-100) */
  opacidadeVidro?: number;
  /** Liquid Glass: intensidade do blur (0-100) */
  desfocoVidro?: number;
  /** Liquid Glass: intensidade do vidro (0-100) - controla brilho/reflexos */
  intensidadeVidro?: number;
}

export interface UserSettings {
  weeklyEmail: boolean;
  newFollowerAlerts: boolean;
  language: string;
  timezone: string;
}

export interface AnalyticsData {
  visualizacoes: number;
  cliques: number;
  ctr: number;
  seguidores: number;
  /** Visitantes únicos (hashVisitante distintos) */
  uniqueVisitors: number;
  /** Crescimento real de visitantes: últimos 7 dias vs os 7 anteriores (%) */
  visitorGrowth: number;
  weeklyGrowth: number;
  monthlyGrowth: number;
  topLinks: TopLink[];
  topCountries: TopCountry[];
  topDevices: TopDevice[];
  recentVisitors: Visitor[];
  hourlyStats: HourlyStat[];
  dailyStats: DailyStat[];
}

export interface TopLink {
  id: string;
  titulo: string;
  url?: string;
  cliques: number;
  ctr: number;
}

export interface TopCountry {
  pais: string;
  codigoPais?: string;
  region?: string;
  cidade?: string;
  count: number;
}

export interface TopDevice {
  tipo: "mobile" | "desktop" | "tablet";
  count: number;
  percentage: number;
}

export interface Visitor {
  id: string;
  pais: string;
  codigoPais?: string;
  cidade?: string;
  dispositivo: string;
  navegador: string;
  sistemaOperativo: string;
  origem?: string;
  time: string;
}

export interface HourlyStat {
  hour: string;
  visualizacoes: number;
  cliques: number;
}

export interface DailyStat {
  day: string;
  visualizacoes: number;
  cliques: number;
}

export interface QRCodeOptions {
  corPrimeiroPlano: string;
  corFundo: string;
  logo?: string;
  tamanho: number;
}

// ---------- Security Logs ----------

export type SecurityEventType =
  | "login_attempt"
  | "login_success"
  | "login_failure"
  | "register_attempt"
  | "register_success"
  | "register_failure"
  | "logout"
  | "oauth_failure"
  | "suspicious_input"
  | "rate_limit_hit"
  | "password_reset_request";

export interface SecurityLogEntry {
  $id: string;
  idUtilizador: string;
  tipoEvento: SecurityEventType;
  email?: string;
  enderecoIP?: string;
  agenteUtilizador?: string;
  metadados?: string; // JSON string with extra info
  criadoEm: string;
}

export interface SecurityLogInput {
  idUtilizador: string;
  tipoEvento: SecurityEventType;
  email?: string;
  enderecoIP?: string;
  agenteUtilizador?: string;
  metadados?: Record<string, unknown>;
}

// ---------- Activity Logs (Atividades recentes) ----------

/** Ações de conta registadas no cartão "Atividades recentes". */
export type ActivityAction =
  | "login"
  | "logout"
  | "register"
  | "page_created"
  | "page_updated"
  | "page_published"
  | "page_unpublished"
  | "link_created"
  | "link_updated"
  | "link_deleted"
  | "appearance_updated"
  | "avatar_updated"
  | "banner_updated"
  | "badge_earned"
  | "staff_applied";

// ---------- Badges ----------

/** Identificadores de badges do LinkFlow. */
export type BadgeId =
  | "verified"
  | "staff"
  | "supporter"
  | "early"
  | "pro"
  | "partner";

/** Estado de uma candidatura ao staff. */
export type StaffApplicationStatus = "pending" | "approved" | "rejected";

/** Candidatura ao staff guardada na coleção staff_applications. */
export interface StaffApplication {
  $id: string;
  idUtilizador: string;
  mensagem: string;
  estado: StaffApplicationStatus;
  /** Identificador da revisão confiável feita pela equipa/server. */
  revistoPor?: string;
  criadoEm: string;
}

export interface ActivityEntry {
  $id: string;
  idUtilizador: string;
  acao: ActivityAction;
  detalhes?: string; // JSON string with extra info (ex: link title)
  enderecoIP?: string;
  agenteUtilizador?: string;
  criadoEm: string;
}
