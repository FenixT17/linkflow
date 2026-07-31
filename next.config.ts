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
    return [
      {
        source: "/(.*)",
        headers: [
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
        ],
      },
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
    ];
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
