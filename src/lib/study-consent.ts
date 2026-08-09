"use client";

export const STUDY_CONSENT_KEY = "linkflow-study-consent";

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
    if (granted) window.localStorage.setItem(STUDY_CONSENT_KEY, "granted");
    else window.localStorage.removeItem(STUDY_CONSENT_KEY);
    window.dispatchEvent(new CustomEvent("linkflow-study-consent", { detail: granted }));
  } catch {
    // A recolha permanece desativada se o armazenamento local estiver indisponível.
  }
}
