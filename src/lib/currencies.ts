/**
 * Moedas por país e formatação de preços na moeda local.
 *
 * Quando o utilizador cria uma conta, o SaaS recolhe o país (via IP no
 * servidor) e guarda `country`/`countryCode`/`currency` no documento users.
 * A página de Faturação mostra os preços convertidos para a moeda do país
 * (base EUR com taxas indicativas — substituíveis por taxas reais futuras).
 */

/** Mapeamento ISO 3166-1 alpha-2 → ISO 4217. */
export const COUNTRY_CURRENCY: Record<string, string> = {
  PT: "EUR", ES: "EUR", FR: "EUR", DE: "EUR", IT: "EUR", NL: "EUR", BE: "EUR",
  AT: "EUR", IE: "EUR", FI: "EUR", GR: "EUR", SK: "EUR", SI: "EUR", LT: "EUR",
  LV: "EUR", EE: "EUR", CY: "EUR", MT: "EUR", LU: "EUR",
  US: "USD", CA: "CAD", GB: "GBP", AU: "AUD", NZ: "NZD", CH: "CHF", NO: "NOK",
  SE: "SEK", DK: "DKK", JP: "JPY", CN: "CNY", IN: "INR", KR: "KRW", SG: "SGD",
  BR: "BRL", MX: "MXN", AR: "ARS", CL: "CLP", CO: "COP", PE: "PEN", UY: "UYU",
  ZA: "ZAR", NG: "NGN", EG: "EGP", MA: "MAD", TR: "TRY", PL: "PLN", CZ: "CZK",
  HU: "HUF", RO: "RON", UA: "UAH", IL: "ILS", AE: "AED", SA: "SAR", TH: "THB",
  ID: "IDR", MY: "MYR", PH: "PHP", VN: "VND", HK: "HKD", TW: "TWD",
};

/** Moeda padrão quando o país é desconhecido (ou sem correspondência). */
export const DEFAULT_CURRENCY = "EUR";

/** Preços de referência em euros (base de cálculo). */
export const PLAN_PRICES_EUR = {
  free: 0,
  pro: 7.99,
  business: 19.99,
} as const;

/** Preços anuais (10 meses — poupança de ~17%). */
export function annualPriceEur(monthlyEur: number): number {
  return Math.round(monthlyEur * 10 * 100) / 100;
}

/**
 * Taxas indicativas face ao EUR (1 EUR = X). Estáticas por agora — quando
 * houver integração de pagamentos real, substituir por taxas da API.
 */
const EUR_RATES: Record<string, number> = {
  EUR: 1, USD: 1.08, CAD: 1.47, GBP: 0.85, AUD: 1.65, NZD: 1.79, CHF: 0.95,
  NOK: 11.5, SEK: 11.3, DKK: 7.46, JPY: 165, CNY: 7.8, INR: 90, KRW: 1480,
  SGD: 1.45, BRL: 5.9, MXN: 18.5, ARS: 1100, CLP: 1000, COP: 4400, PEN: 4.05,
  UYU: 43, ZAR: 20, NGN: 1700, EGP: 52, MAD: 10.8, TRY: 37, PLN: 4.3, CZK: 25,
  HUF: 405, RON: 4.97, UAH: 44, ILS: 3.9, AED: 3.97, SAR: 4.05, THB: 39,
  IDR: 17400, MYR: 5.1, PHP: 63, VND: 27500, HKD: 8.45, TWD: 35,
};

/** Locale preferido para formatar cada moeda (fallback pt-PT). */
const CURRENCY_LOCALE: Record<string, string> = {
  EUR: "pt-PT", USD: "en-US", CAD: "en-CA", GBP: "en-GB", AUD: "en-AU",
  NZD: "en-NZ", CHF: "de-CH", NOK: "nb-NO", SEK: "sv-SE", DKK: "da-DK",
  JPY: "ja-JP", CNY: "zh-CN", INR: "en-IN", KRW: "ko-KR", SGD: "en-SG",
  BRL: "pt-BR", MXN: "es-MX", ARS: "es-AR", CLP: "es-CL", COP: "es-CO",
  PEN: "es-PE", UYU: "es-UY", ZAR: "en-ZA", NGN: "en-NG", EGP: "ar-EG",
  MAD: "ar-MA", TRY: "tr-TR", PLN: "pl-PL", CZK: "cs-CZ", HUF: "hu-HU",
  RON: "ro-RO", UAH: "uk-UA", ILS: "he-IL", AED: "ar-AE", SAR: "ar-SA",
  THB: "th-TH", IDR: "id-ID", MYR: "ms-MY", PHP: "fil-PH", VND: "vi-VN",
  HKD: "zh-HK", TWD: "zh-TW",
};

/** Moeda para um código de país ISO alpha-2 (fallback EUR). */
export function currencyForCountry(countryCode?: string | null): string {
  if (!countryCode) return DEFAULT_CURRENCY;
  const code = countryCode.toUpperCase();
  return COUNTRY_CURRENCY[code] ?? DEFAULT_CURRENCY;
}

/** Taxa da moeda face ao EUR (fallback 1). */
export function eurToRate(currency: string): number {
  return EUR_RATES[currency] ?? 1;
}

/** Converte um valor em EUR para a moeda indicada. */
export function convertFromEur(amountEur: number, currency: string): number {
  return amountEur * eurToRate(currency);
}

/**
 * Formata um valor em euros na moeda local (converte + formata com Intl).
 * Ex: convertAndFormat(7.99, "BRL") → "R$ 47,14"
 */
export function convertAndFormat(amountEur: number, currency: string): string {
  const code = currency || DEFAULT_CURRENCY;
  const converted = convertFromEur(amountEur, code);
  try {
    return new Intl.NumberFormat(CURRENCY_LOCALE[code] ?? "pt-PT", {
      style: "currency",
      currency: code,
      minimumFractionDigits: converted % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(converted);
  } catch {
    return `${converted.toFixed(2)} ${code}`;
  }
}

/** Símbolo da moeda (ex: "€", "R$", "$"). Fallback para o próprio código. */
export function currencySymbol(currency: string): string {
  const code = currency || DEFAULT_CURRENCY;
  try {
    const parts = new Intl.NumberFormat(CURRENCY_LOCALE[code] ?? "pt-PT", {
      style: "currency",
      currency: code,
    }).formatToParts(0);
    const symbol = parts.find((p) => p.type === "currency")?.value;
    return symbol ?? code;
  } catch {
    return code;
  }
}
