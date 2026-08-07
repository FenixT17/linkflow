import type { Metadata, Viewport } from "next";
import { Inter, Geist } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import { ZoomBlocker } from "@/components/zoom-blocker";
import { organizationJsonLd, websiteJsonLd, softwareApplicationJsonLd, renderJsonLd, siteUrl, siteName, siteTagline, defaultDescription } from "@/lib/seo";
import { THEME_SCRIPT, THEME_SANITIZER_SCRIPT } from "@/lib/theme-security";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: {
    default: `${siteName} — ${siteTagline}`,
    template: "%s | " + siteName,
  },
  description: defaultDescription,
  applicationName: siteName,
  keywords: [
    "link in bio",
    "linktree",
    "página pessoal",
    "links redes sociais",
    "LinkFlow",
    "link bio",
    "personal page",
  ],
  authors: [{ name: siteName }],
  creator: siteName,
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: siteUrl,
    siteName,
    title: `${siteName} — ${siteTagline}`,
    description: defaultDescription,
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: `${siteName} — ${siteTagline}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteName} — ${siteTagline}`,
    description: defaultDescription,
    images: [`${siteUrl}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: siteUrl,
    languages: {
      "x-default": siteUrl,
    },
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/logo.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon-32x32.png",
    apple: { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
};

const structuredData = [organizationJsonLd(), websiteJsonLd(), softwareApplicationJsonLd()];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Sanitização pré-hidratação: valida localStorage["theme"] contra a
            whitelist ANTES do script inline do next-themes o aplicar ao DOM
            (previne DOM XSS via secondary source — CWE-79). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SANITIZER_SCRIPT }} />
        {/* Aplica o tema antes da hidratação (substitui o script inline do
            next-themes — ver THEME_SCRIPT em lib/theme-security.ts). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={renderJsonLd(structuredData)}
        />
      </head>
      <body
        className={`${inter.variable} ${geist.variable}`}
      >
        <ThemeProvider defaultTheme="dark">
          <ToastProvider>
            <AuthProvider>
              <ZoomBlocker />
              {children}
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
