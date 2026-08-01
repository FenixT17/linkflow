import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable compression for all responses
  compress: true,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.qrserver.com",
      },
      {
        protocol: "https",
        hostname: "cloud.appwrite.io",
      },
      {
        protocol: "https",
        hostname: "*.cloud.appwrite.io",
      },
    ],
  },


  // Security headers — applied to all routes
  async headers() {
    const isProduction = process.env.NODE_ENV === "production";

    const securityHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      { key: "X-DNS-Prefetch-Control", value: "on" },
      {
        key: "Cross-Origin-Opener-Policy",
        value: "same-origin-allow-popups",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
      },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self';",
          // L3 (avaliado, adiado de propósito): a versão nonce-based
          // (script-src 'self' 'nonce-XYZ' 'strict-dynamic') exige gerar um
          // nonce por request no middleware e passá-lo ao script inline do
          // next-themes + ao THEME_SANITIZER_SCRIPT no layout. Isso requer
          // refactor coordenado (middleware + layout + theme-security.ts) e
          // risco de quebrar a hidratação do tema. Mantém-se 'unsafe-inline'
          // com a whitelist de valores do tema já validada à parte
          // (theme-security.ts) — a superfície de XSS via localStorage foi
          // eliminada por whitelist estrita, não por CSP.
          "script-src 'self' 'unsafe-inline' 'unsafe-eval';",
          "frame-src 'self';",
          "style-src 'self' 'unsafe-inline';",
          "img-src 'self' data: https: blob:;",
          "font-src 'self' data:;",
          "connect-src 'self' https://cloud.appwrite.io https://*.cloud.appwrite.io;",
          "base-uri 'self';",
          "form-action 'self';",
          "object-src 'none';",
          "frame-ancestors 'none';",
        ].join(" "),
      },
    ];

    const rules: {
      source: string;
      headers: { key: string; value: string }[];
    }[] = [{ source: "/(.*)", headers: securityHeaders }];

    // Aggressive immutable caching is ONLY safe in production builds, where
    // Next.js fingerprints every static chunk with a content hash in the URL
    // (e.g. app/layout-<hash>.js). In dev mode chunk URLs have NO hash
    // (app/layout.js), so sending `immutable` here makes the browser cache the
    // OLD bundle for a year — stale chunks cause runtime errors like
    // "Cannot read properties of undefined (reading 'call')" after any edit to
    // the root layout / providers. In dev, fall back to Next.js defaults.
    if (isProduction) {
      rules.push(
        // Aggressive caching for static JS/CSS/assets
        {
          source: "/_next/static/:path*",
          headers: [
            {
              key: "Cache-Control",
              value: "public, max-age=31536000, immutable",
            },
          ],
        },
        // Cache images for 1 week
        {
          source: "/:path*.(jpg|jpeg|png|webp|avif|gif|svg|ico)",
          headers: [
            {
              key: "Cache-Control",
              value: "public, max-age=604800, immutable",
            },
          ],
        },
        // Cache fonts for 1 year
        {
          source: "/:path*.(woff|woff2|ttf|otf|eot)",
          headers: [
            {
              key: "Cache-Control",
              value: "public, max-age=31536000, immutable",
            },
          ],
        },
      );
    }

    return rules;
  },
  async redirects() {
    return [
      {
        source: "/dashboard/qr",
        destination: "/dashboard",
        permanent: false,
      },
      {
        source: "/dashboard/integrations",
        destination: "/dashboard",
        permanent: false,
      },
      {
        source: "/dashboard/security",
        destination: "/dashboard/settings",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/@:username",
        destination: "/u/:username",
      },
      {
        source: "/sitemap.xml.gz",
        destination: "/api/sitemap.xml.gz",
      },
    ];
  },
};

export default nextConfig;
