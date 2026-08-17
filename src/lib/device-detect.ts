/**
 * Detecta o tipo de dispositivo a partir do user-agent string.
 *
 * Usa heurísticas baseadas em padrões conhecidos de mobile/tablet.
 * Não depende de bibliotecas externas — lógica leve e rápida.
 */

export type DeviceType = "mobile" | "desktop" | "tablet";

const MOBILE_RE =
  /Android.*Mobile|iPhone|iPod|BlackBerry|Opera Mini|Opera Mobi|IEMobile|webOS|Windows Phone|Kindle|Silk|KFAPW|KFASWI|KFJWI|KFSOWI|KFTHWI|KFTT|KFOT|KFTEWI|KFAWI|KFFOWI|KFGIWI|KFMOWI|KFNWFI|KFOBWI|KFONWI|KFSNWI|KFARWI|KFIARWI|KFNARI|KFTABI|KFSUWI|KFMEWI|KFN2WI|KFTRWI|KFME|KFMEWI|KFAUWI|KFAUARI|KFFOWI|KFIOWI|KFIOWFI|KFMOWI|KFNWFI|KFQOARI|KFQONWI|KFQUWI|KFSMOWI|KFTBWI|KFTHOWI|KFTUWI|KFTUARI|KFUXWI|KFWASI|KFWFSWI|KFQASI|KFQFSWI|KFQUSWI|KFULWI|KFULASI|KFULEWI|KFUNEWI|KFUNEWI|KFUQWI|KFUSWI|KFUWFI|KFUYWI/i;

const TABLET_RE =
  /iPad|Android(?!.*Mobile)|Tablet|PlayBook|Silk(?!.*Mobile)|Kindle(?!.*Mobile)|KFAPWI|KFASWI|KFJWI|KFSOWI|KFTHWI|KFTT|KFOT|KFTEWI|KFAWI|KFFOWI|KFGIWI|KFMOWI|KFNWFI|KFONWI|KFSNWI/i;

/**
 * Detecta o tipo de dispositivo a partir do user-agent.
 *
 * Ordem de verificação:
 * 1. Se corresponde a tablet → "tablet"
 * 2. Se corresponde a mobile → "mobile"
 * 3. Caso contrário → "desktop"
 */
export function detectDeviceType(agenteUtilizador: string | null | undefined): DeviceType {
  if (!agenteUtilizador) return "desktop";

  // Tablet primeiro — alguns tablets Android reportam "Mobile" no UA,
  // mas o padrão tablet é mais específico e deve ter prioridade.
  if (TABLET_RE.test(agenteUtilizador)) return "tablet";
  if (MOBILE_RE.test(agenteUtilizador)) return "mobile";

  return "desktop";
}

/**
 * Deteta o browser a partir do user-agent.
 */
export function detectBrowser(agenteUtilizador: string | null | undefined): string {
  if (!agenteUtilizador) return "Desconhecido";
  const ua = agenteUtilizador.toLowerCase();
  if (ua.includes("edg/")) return "Edge";
  if (ua.includes("opr/") || ua.includes("opera")) return "Opera";
  if (ua.includes("chrome") && !ua.includes("chromium")) return "Chrome";
  if (ua.includes("firefox")) return "Firefox";
  if (ua.includes("safari") && !ua.includes("chrome")) return "Safari";
  if (ua.includes("samsungbrowser")) return "Samsung Internet";
  if (ua.includes("ucbrowser")) return "UC Browser";
  return "Outro";
}

/**
 * Deteta o sistema operativo a partir do user-agent.
 */
export function detectOS(agenteUtilizador: string | null | undefined): string {
  if (!agenteUtilizador) return "Desconhecido";
  const ua = agenteUtilizador.toLowerCase();
  if (ua.includes("windows")) return "Windows";
  if (ua.includes("android")) return "Android";
  if (ua.includes("iphone") || ua.includes("ipod")) return "iOS";
  if (ua.includes("ipad") || (ua.includes("macintosh") && ua.includes("mobile"))) return "iPadOS";
  if (ua.includes("mac os") || ua.includes("macintosh")) return "macOS";
  if (ua.includes("linux")) return "Linux";
  return "Outro";
}

/**
 * Regista o tipo de dispositivo no metricasJson.
 * Devolve o metricasJson atualizado.
 */
export function recordDeviceVisit(
  metricasJson: Record<string, unknown>,
  agenteUtilizador: string
): Record<string, unknown> {
  const deviceType = detectDeviceType(agenteUtilizador);
  const deviceLog: string[] = Array.isArray(metricasJson.deviceLog) ? metricasJson.deviceLog : [];
  deviceLog.push(deviceType);
  // Manter apenas as últimas 1000 entradas para evitar crescimento ilimitado
  const trimmedDeviceLog = deviceLog.length > 1000 ? deviceLog.slice(-1000) : deviceLog;
  return { ...metricasJson, deviceLog: trimmedDeviceLog };
}
