import type { NextRequest } from "next/server";

export const STUDY_CONSENT_COOKIE = "linkflow-study-consent";

export function isStudyConsentGranted(request: NextRequest): boolean {
  return request.cookies.get(STUDY_CONSENT_COOKIE)?.value === "granted";
}
