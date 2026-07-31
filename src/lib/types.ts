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

export interface PageProfile {
  username: string;
  displayName: string;
  bio: string;
  avatar?: string;
  banner?: string;
  published: boolean;
  scheduledPublishAt?: string;
  scheduledUnpublishAt?: string;
  social?: SocialLinks;
}

export interface SocialLinks {
  instagram?: string;
  twitter?: string;
  tiktok?: string;
  youtube?: string;
  github?: string;
  linkedin?: string;
  discord?: string;
  telegram?: string;
  whatsapp?: string;
  email?: string;
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
  showSocial: boolean;
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
  clicks: number;
  ctr: number;
}

export interface TopCountry {
  country: string;
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
  device: string;
  browser: string;
  os: string;
  language: string;
  resolution: string;
  firstVisit: string;
  lastVisit: string;
  visits: number;
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
