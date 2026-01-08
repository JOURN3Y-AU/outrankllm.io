import type { Metadata } from "next";
import { Outfit, DM_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "outrankllm.io | AI Visibility for Vibe Coders",
  description:
    "Your vibe-coded business is invisible to ChatGPT. We fix that. Get your free AI visibility report.",
  keywords: [
    "AI visibility",
    "ChatGPT SEO",
    "Claude SEO",
    "Gemini SEO",
    "vibe coding",
    "GEO",
    "generative engine optimization",
  ],
  authors: [{ name: "outrankllm" }],
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/apple-icon.svg', type: 'image/svg+xml' },
    ],
  },
  openGraph: {
    title: "outrankllm.io | AI Visibility for Vibe Coders",
    description: "Your vibe-coded business is invisible to ChatGPT. We fix that.",
    url: "https://outrankllm.io",
    siteName: "outrankllm.io",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "outrankllm.io | AI Visibility for Vibe Coders",
    description: "Your vibe-coded business is invisible to ChatGPT. We fix that.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${dmMono.variable}`}>
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-L2RQHE6GT0"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-L2RQHE6GT0');
          `}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
