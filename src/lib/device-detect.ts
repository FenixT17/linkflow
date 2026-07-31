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
export function detectDeviceType(userAgent: string | null | undefined): DeviceType {
  if (!userAgent) return "desktop";

  // Tablet primeiro — alguns tablets Android reportam "Mobile" no UA,
  // mas o padrão tablet é mais específico e deve ter prioridade.
  if (TABLET_RE.test(userAgent)) return "tablet";
  if (MOBILE_RE.test(userAgent)) return "mobile";

  return "desktop";
}

/**
 * Regista o tipo de dispositivo no metricsJson.
 * Devolve o metricsJson atualizado.
 */
export function recordDeviceVisit(
  metricsJson: Record<string, unknown>,
  userAgent: string
): Record<string, unknown> {
  const deviceType = detectDeviceType(userAgent);
  const deviceLog: string[] = Array.isArray(metricsJson.deviceLog) ? metricsJson.deviceLog : [];
  deviceLog.push(deviceType);
  // Manter apenas as últimas 1000 entradas para evitar crescimento ilimitado
  const trimmedDeviceLog = deviceLog.length > 1000 ? deviceLog.slice(-1000) : deviceLog;
  return { ...metricsJson, deviceLog: trimmedDeviceLog };
}
