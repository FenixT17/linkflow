"use client";

export const STUDY_CONSENT_COOKIE = "linkflow-study-consent";
export const STUDY_CONSENT_KEY = STUDY_CONSENT_COOKIE;
const CONSENT_MAX_AGE = 60 * 60 * 24 * 365;

export function hasStudyConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STUDY_CONSENT_KEY) === "granted";
  } catch {
    return false;
  }
}

export function setStudyConsent(granted: boolean): void {
  try {
    if (granted) {
      window.localStorage.setItem(STUDY_CONSENT_KEY, "granted");
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${STUDY_CONSENT_COOKIE}=granted; Path=/; Max-Age=${CONSENT_MAX_AGE}; SameSite=Lax${secure}`;
    } else {
      window.localStorage.removeItem(STUDY_CONSENT_KEY);
      document.cookie = `${STUDY_CONSENT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    }
    window.dispatchEvent(new CustomEvent("linkflow-study-consent", { detail: granted }));
  } catch {
    // A recolha permanece desativada se o armazenamento local estiver indisponível.
  }
}
