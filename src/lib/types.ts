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
  type: LinkItemType;
  title: string;
  description?: string;
  url: string;
  icon?: string;
  color?: string;
  image?: string;
  animation?: "fade" | "slide" | "scale" | "none";
  active: boolean;
  visible: boolean;
  newTab: boolean;
  order: number;
  clicks: number;
  scheduledFor?: string;
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

export interface PageProfile {
  username: string;
  displayName: string;
  bio: string;
  avatar?: string;
  banner?: string;
  published: boolean;
  pageType?: PageType;
  /** Badges ativas da página (ex: ["verified", "supporter"]) */
  badges?: string[];
  scheduledPublishAt?: string;
  scheduledUnpublishAt?: string;
}

export interface UserAccount {
  email: string;
  displayName: string;
  createdAt: string;
  plan: PlanType;
}

export type PlanType = "free" | "pro" | "business" | "enterprise";

export interface Appearance {
  blur: number;
  rounded: number;
  linkOpacity: number;
  backgroundColor?: string;
  cardColor?: string;
  textColor?: string;
  accentColor?: string;
  fontFamily?: string;
  fontSize?: number;
  buttonRadius?: number;
  buttonWidth?: "narrow" | "normal" | "wide" | "full";
  buttonHeight?: "compact" | "normal" | "tall";
  buttonStyle?: "solid" | "outline" | "soft" | "glass";
  shadow?: "none" | "sm" | "md" | "lg";
  showAvatar: boolean;
  showBio: boolean;
  spacing: number;
  /** Glass-specific: cor da borda das barras (ex: "rgba(255,255,255,0.06)") */
  borderColor?: string;
  /** Glass-specific: espessura da borda em pixels */
  borderWidth?: number;
  /** Liquid Glass: opacidade global do vidro (0-100) */
  glassOpacity?: number;
  /** Liquid Glass: intensidade do blur (0-100) */
  glassBlur?: number;
  /** Liquid Glass: intensidade do vidro (0-100) - controla brilho/reflexos */
  glassStrength?: number;
}

export interface UserSettings {
  weeklyEmail: boolean;
  newFollowerAlerts: boolean;
  language: string;
  timezone: string;
}

export interface AnalyticsData {
  views: number;
  clicks: number;
  ctr: number;
  followers: number;
  /** Visitantes únicos (visitorHash distintos) */
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
  title: string;
  url?: string;
  clicks: number;
  ctr: number;
}

export interface TopCountry {
  country: string;
  countryCode?: string;
  region?: string;
  city?: string;
  count: number;
}

export interface TopDevice {
  type: "mobile" | "desktop" | "tablet";
  count: number;
  percentage: number;
}

export interface Visitor {
  id: string;
  country: string;
  countryCode?: string;
  city?: string;
  device: string;
  browser: string;
  os: string;
  referer?: string;
  time: string;
}

export interface HourlyStat {
  hour: string;
  views: number;
  clicks: number;
}

export interface DailyStat {
  day: string;
  views: number;
  clicks: number;
}

export interface QRCodeOptions {
  fgColor: string;
  bgColor: string;
  logo?: string;
  size: number;
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
  userId: string;
  eventType: SecurityEventType;
  email?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: string; // JSON string with extra info
  createdAt: string;
}

export interface SecurityLogInput {
  userId: string;
  eventType: SecurityEventType;
  email?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
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
  userId: string;
  message: string;
  status: StaffApplicationStatus;
  createdAt: string;
}

export interface ActivityEntry {
  $id: string;
  userId: string;
  action: ActivityAction;
  details?: string; // JSON string with extra info (ex: link title)
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}
