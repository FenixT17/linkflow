/**
 * Platform catalog for LinkFlow.
 *
 * To add a new platform in the future, simply append an entry to PLATFORMS
 * and add its icon to the icon map in components/ui/platform-icon.tsx.
 * No other changes to the system are required.
 */

export type PlatformCategoryId =
  | "social"
  | "messaging"
  | "music"
  | "video"
  | "programming"
  | "design"
  | "streaming"
  | "gaming"
  | "business"
  | "stores"
  | "payments"
  | "portfolios"
  | "contact";

export interface PlatformCategory {
  id: PlatformCategoryId;
  label: string;
}

export interface Platform {
  /** Unique identifier — stored in LinkItem.icon */
  id: string;
  /** Display name */
  name: string;
  /** Category id */
  category: PlatformCategoryId;
  /** Brand color (hex with #) */
  color: string;
  /** Lowercase keywords for search (name is searched automatically) */
  keywords?: string[];
  /** Optional URL prefix for future auto-completion */
  urlPrefix?: string;
}

export const CATEGORIES: PlatformCategory[] = [
  { id: "social", label: "Redes Sociais" },
  { id: "messaging", label: "Mensagens" },
  { id: "music", label: "Música" },
  { id: "video", label: "Vídeo" },
  { id: "programming", label: "Programação" },
  { id: "design", label: "Design" },
  { id: "streaming", label: "Streaming" },
  { id: "gaming", label: "Gaming" },
  { id: "business", label: "Negócios" },
  { id: "stores", label: "Lojas" },
  { id: "payments", label: "Pagamentos" },
  { id: "portfolios", label: "Portfólios" },
  { id: "contact", label: "Contacto" },
];

export const PLATFORMS: Platform[] = [
  // ── Redes Sociais ──
  { id: "instagram", name: "Instagram", category: "social", color: "#FF0069", keywords: ["insta", "foto"], urlPrefix: "https://instagram.com/" },
  { id: "facebook", name: "Facebook", category: "social", color: "#0866FF", keywords: ["fb"], urlPrefix: "https://facebook.com/" },
  { id: "x", name: "X (Twitter)", category: "social", color: "#000000", keywords: ["twitter", "tweet"], urlPrefix: "https://x.com/" },
  { id: "threads", name: "Threads", category: "social", color: "#000000", urlPrefix: "https://threads.net/" },
  { id: "tiktok", name: "TikTok", category: "social", color: "#000000", keywords: ["tik tok"], urlPrefix: "https://tiktok.com/@" },
  { id: "youtube", name: "YouTube", category: "social", color: "#FF0000", keywords: ["yt", "video"], urlPrefix: "https://youtube.com/@" },
  { id: "twitch", name: "Twitch", category: "social", color: "#9146FF", keywords: ["stream", "live"], urlPrefix: "https://twitch.tv/" },
  { id: "kick", name: "Kick", category: "social", color: "#53FC19", keywords: ["streaming"], urlPrefix: "https://kick.com/" },
  { id: "discord", name: "Discord", category: "social", color: "#5865F2", urlPrefix: "https://discord.gg/" },
  { id: "reddit", name: "Reddit", category: "social", color: "#FF4500", urlPrefix: "https://reddit.com/user/" },
  { id: "snapchat", name: "Snapchat", category: "social", color: "#FFFC00", keywords: ["snap"], urlPrefix: "https://snapchat.com/add/" },
  { id: "pinterest", name: "Pinterest", category: "social", color: "#BD081C", keywords: ["pins"], urlPrefix: "https://pinterest.com/" },
  { id: "linkedin", name: "LinkedIn", category: "social", color: "#0A66C2", keywords: ["trabalho", "emprego"], urlPrefix: "https://linkedin.com/in/" },
  { id: "bluesky", name: "Bluesky", category: "social", color: "#1185FE", keywords: ["blue sky", "bsky"], urlPrefix: "https://bsky.app/profile/" },
  { id: "mastodon", name: "Mastodon", category: "social", color: "#6364FF", keywords: ["fediverso"], urlPrefix: "https://mastodon.social/@" },
  { id: "tumblr", name: "Tumblr", category: "social", color: "#36465D", urlPrefix: "https://tumblr.com/" },
  { id: "vk", name: "VK", category: "social", color: "#0077FF", keywords: ["vkontakte"], urlPrefix: "https://vk.com/" },
  { id: "weibo", name: "Weibo", category: "social", color: "#E6162D", keywords: ["sina"], urlPrefix: "https://weibo.com/" },

  // ── Mensagens ──
  { id: "whatsapp", name: "WhatsApp", category: "messaging", color: "#25D366", keywords: ["wpp", "zap"], urlPrefix: "https://wa.me/" },
  { id: "telegram", name: "Telegram", category: "messaging", color: "#26A5E4", keywords: ["tg"], urlPrefix: "https://t.me/" },
  { id: "signal", name: "Signal", category: "messaging", color: "#3B45FD" },
  { id: "messenger", name: "Messenger", category: "messaging", color: "#0866FF", keywords: ["fb messenger"], urlPrefix: "https://m.me/" },
  { id: "line", name: "LINE", category: "messaging", color: "#00C300" },
  { id: "wechat", name: "WeChat", category: "messaging", color: "#07C160", keywords: ["weixin"] },
  { id: "viber", name: "Viber", category: "messaging", color: "#7360F2" },
  { id: "skype", name: "Skype", category: "messaging", color: "#00AFF0" },

  // ── Música ──
  { id: "spotify", name: "Spotify", category: "music", color: "#1ED760", urlPrefix: "https://open.spotify.com/" },
  { id: "applemusic", name: "Apple Music", category: "music", color: "#FA243C", keywords: ["apple", "music"] },
  { id: "soundcloud", name: "SoundCloud", category: "music", color: "#FF5500", keywords: ["sound cloud"], urlPrefix: "https://soundcloud.com/" },
  { id: "deezer", name: "Deezer", category: "music", color: "#A238FF" },
  { id: "tidal", name: "Tidal", category: "music", color: "#000000" },
  { id: "audiomack", name: "Audiomack", category: "music", color: "#FFA200" },
  { id: "bandcamp", name: "Bandcamp", category: "music", color: "#408294", urlPrefix: "https://bandcamp.com/" },

  // ── Vídeo ──
  { id: "vimeo", name: "Vimeo", category: "video", color: "#1AB7EA", urlPrefix: "https://vimeo.com/" },
  { id: "dailymotion", name: "Dailymotion", category: "video", color: "#0A0A0A", keywords: ["dailymotion"] },
  { id: "rumble", name: "Rumble", category: "video", color: "#85C742" },
  { id: "odysee", name: "Odysee", category: "video", color: "#EF1970" },

  // ── Programação ──
  { id: "github", name: "GitHub", category: "programming", color: "#181717", keywords: ["git"], urlPrefix: "https://github.com/" },
  { id: "gitlab", name: "GitLab", category: "programming", color: "#FC6D26", urlPrefix: "https://gitlab.com/" },
  { id: "bitbucket", name: "Bitbucket", category: "programming", color: "#0052CC", urlPrefix: "https://bitbucket.org/" },
  { id: "stackoverflow", name: "Stack Overflow", category: "programming", color: "#F58025", keywords: ["stack", "so"], urlPrefix: "https://stackoverflow.com/users/" },

  // ── Design ──
  { id: "behance", name: "Behance", category: "design", color: "#1769FF", urlPrefix: "https://behance.net/" },
  { id: "dribbble", name: "Dribbble", category: "design", color: "#EA4C89", urlPrefix: "https://dribbble.com/" },
  { id: "figma", name: "Figma", category: "design", color: "#F24E1E", urlPrefix: "https://figma.com/@" },
  { id: "adobeportfolio", name: "Adobe Portfolio", category: "design", color: "#000000", keywords: ["adobe", "portfolio"] },

  // ── Streaming ──
  { id: "netflix", name: "Netflix", category: "streaming", color: "#E50914" },
  { id: "primevideo", name: "Prime Video", category: "streaming", color: "#00A8E1", keywords: ["amazon prime"] },
  { id: "disneyplus", name: "Disney+", category: "streaming", color: "#0CC473", keywords: ["disney", "disney plus"] },
  { id: "max", name: "Max", category: "streaming", color: "#525252", keywords: ["hbo", "hbo max"] },
  { id: "crunchyroll", name: "Crunchyroll", category: "streaming", color: "#FF5E00", keywords: ["anime"] },

  // ── Gaming ──
  { id: "steam", name: "Steam", category: "gaming", color: "#000000", urlPrefix: "https://steamcommunity.com/id/" },
  { id: "epicgames", name: "Epic Games", category: "gaming", color: "#313131", keywords: ["epic"] },
  { id: "xbox", name: "Xbox", category: "gaming", color: "#107C10" },
  { id: "playstation", name: "PlayStation", category: "gaming", color: "#0070D1", keywords: ["psn", "ps"] },
  { id: "nintendo", name: "Nintendo", category: "gaming", color: "#E60012" },
  { id: "riotgames", name: "Riot Games", category: "gaming", color: "#EB0029", keywords: ["riot", "league"] },
  { id: "roblox", name: "Roblox", category: "gaming", color: "#000000" },

  // ── Negócios ──
  { id: "calendly", name: "Calendly", category: "business", color: "#006BFF", urlPrefix: "https://calendly.com/" },
  { id: "notion", name: "Notion", category: "business", color: "#000000" },
  { id: "trello", name: "Trello", category: "business", color: "#0052CC" },
  { id: "slack", name: "Slack", category: "business", color: "#4A154B" },
  { id: "zoom", name: "Zoom", category: "business", color: "#0B5CFF" },
  { id: "googlemeet", name: "Google Meet", category: "business", color: "#00897B", keywords: ["meet", "hangouts"] },
  { id: "microsoftteams", name: "Microsoft Teams", category: "business", color: "#6264A7", keywords: ["teams", "ms teams"] },

  // ── Lojas ──
  { id: "amazon", name: "Amazon", category: "stores", color: "#FF9900" },
  { id: "etsy", name: "Etsy", category: "stores", color: "#F16521", urlPrefix: "https://etsy.com/shop/" },
  { id: "ebay", name: "eBay", category: "stores", color: "#E53238" },
  { id: "shopify", name: "Shopify", category: "stores", color: "#7AB55C" },
  { id: "aliexpress", name: "AliExpress", category: "stores", color: "#FF4747" },

  // ── Pagamentos ──
  { id: "paypal", name: "PayPal", category: "payments", color: "#002991" },
  { id: "stripe", name: "Stripe", category: "payments", color: "#635BFF" },
  { id: "revolut", name: "Revolut", category: "payments", color: "#191C1F" },
  { id: "mbway", name: "MB WAY", category: "payments", color: "#00A3E0", keywords: ["mbway", "multibanco"] },
  { id: "wise", name: "Wise", category: "payments", color: "#9FE870", keywords: ["transferwise"] },
  { id: "kofi", name: "Ko-fi", category: "payments", color: "#FF6433", keywords: ["ko fi", "coffee"], urlPrefix: "https://ko-fi.com/" },
  { id: "buymeacoffee", name: "Buy Me a Coffee", category: "payments", color: "#FFDD00", keywords: ["bmc", "coffee"], urlPrefix: "https://buymeacoffee.com/" },
  { id: "patreon", name: "Patreon", category: "payments", color: "#000000", urlPrefix: "https://patreon.com/" },

  // ── Portfólios ──
  { id: "linktree", name: "Linktree", category: "portfolios", color: "#43E55E", urlPrefix: "https://linktr.ee/" },
  { id: "carrd", name: "Carrd", category: "portfolios", color: "#596CAF", urlPrefix: "https://carrd.co/" },
  { id: "medium", name: "Medium", category: "portfolios", color: "#000000", urlPrefix: "https://medium.com/@" },
  { id: "substack", name: "Substack", category: "portfolios", color: "#FF6719", urlPrefix: "https://substack.com/@" },
  { id: "hashnode", name: "Hashnode", category: "portfolios", color: "#2962FF", urlPrefix: "https://hashnode.com/@" },
  { id: "devto", name: "Dev.to", category: "portfolios", color: "#0A0A0A", keywords: ["dev"], urlPrefix: "https://dev.to/" },

  // ── Contacto ──
  { id: "website", name: "Website", category: "contact", color: "#6366F1", keywords: ["site", "blog", "página"] },
  { id: "email", name: "E-mail", category: "contact", color: "#6366F1", keywords: ["mail", "correo"], urlPrefix: "mailto:" },
  { id: "phone", name: "Telefone", category: "contact", color: "#22C55E", keywords: ["chamada", "numero"], urlPrefix: "tel:" },
  { id: "sms", name: "SMS", category: "contact", color: "#22C55E", keywords: ["mensagem", "texto"], urlPrefix: "sms:" },
  { id: "googlemaps", name: "Google Maps", category: "contact", color: "#4285F4", keywords: ["maps", "localização"] },
  { id: "applemaps", name: "Apple Maps", category: "contact", color: "#000000", keywords: ["maps", "localização"] },
  { id: "waze", name: "Waze", category: "contact", color: "#33CCFF", keywords: ["gps", "navegação"] },
];

// ── Lookup & search ──

const PLATFORM_MAP: Record<string, Platform> = Object.fromEntries(
  PLATFORMS.map((p) => [p.id, p]),
);

export function getPlatform(id: string | undefined): Platform | undefined {
  if (!id) return undefined;
  return PLATFORM_MAP[id];
}

export function searchPlatforms(query: string): Platform[] {
  const q = query.trim().toLowerCase();
  if (!q) return PLATFORMS;
  return PLATFORMS.filter((p) => {
    if (p.name.toLowerCase().includes(q)) return true;
    if (p.id.toLowerCase().includes(q)) return true;
    return p.keywords?.some((k) => k.includes(q)) ?? false;
  });
}

export function getPlatformsByCategory(category: PlatformCategoryId): Platform[] {
  return PLATFORMS.filter((p) => p.category === category);
}
