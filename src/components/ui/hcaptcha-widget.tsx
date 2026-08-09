"use client";

import { useEffect, useRef } from "react";
import { useNonce } from "@/components/ui/nonce-provider";

interface HCaptchaApi {
  render: (element: HTMLElement, options: {
    sitekey: string;
    callback: (token: string) => void;
    "expired-callback": () => void;
    "error-callback": () => void;
  }) => string;
  reset: (widgetId?: string) => void;
}

declare global {
  interface Window {
    hcaptcha?: HCaptchaApi;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadHCaptcha(nonce?: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.hcaptcha) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-linkflow-hcaptcha]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("hCaptcha indisponível")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://js.hcaptcha.com/1/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    if (nonce) script.nonce = nonce;
    script.dataset.linkflowHcaptcha = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("hCaptcha indisponível"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function HCaptchaWidget({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const nonce = useNonce();

  useEffect(() => {
    let cancelled = false;
    if (!siteKey || !containerRef.current) return;

    loadHCaptcha(nonce)
      .then(() => {
        if (cancelled || !containerRef.current || !window.hcaptcha) return;
        containerRef.current.replaceChildren();
        widgetIdRef.current = window.hcaptcha.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => onToken(token),
          "expired-callback": () => onToken(""),
          "error-callback": () => onToken(""),
        });
      })
      .catch(() => onToken(""));

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.hcaptcha) {
        window.hcaptcha.reset(widgetIdRef.current);
      }
    };
  }, [nonce, onToken, siteKey]);

  return <div ref={containerRef} aria-label="Verificação anti-bot" />;
}
