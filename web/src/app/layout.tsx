import type { Metadata, Viewport } from "next";

import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { MasterDataProvider } from "@/contexts/MasterDataContext";
import { TranslationProvider } from "@/contexts/TranslationContext";
import { QuickFilterProvider } from "@/contexts/QuickFilterContext";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import {
  COLOR_SCHEME_STORAGE_KEY,
  DARK_MEDIA_QUERY,
  THEME_CHAR_STORAGE_KEY,
} from "@/lib/colorScheme";
import {
  ADSENSE_SCRIPT_ID,
  ADSENSE_SCRIPT_SRC,
  ADS_FEATURE_ENABLED,
  DEFAULT_SHOW_ADS,
  SHOW_ADS_STORAGE_KEY,
} from "@/lib/ads";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_DOMAIN || "https://pjsk.moe"
  ),
  title: {
    default: "Moesekai - Project Sekai 数据查看器",
    template: "%s | Moesekai",
  },
  description:
    "Moesekai (原Snowy SekaiViewer) — Project Sekai 游戏数据查看器，提供卡牌、音乐、活动、扭蛋等全面的游戏数据浏览。",
  icons: { icon: "/data/icon/icon.jpg" },
  openGraph: {
    type: "website",
    siteName: "Moesekai",
    locale: "zh_CN",
    images: [{ url: "/data/icon/icon.jpg", width: 512, height: 512 }],
  },
  twitter: {
    card: "summary",
    images: ["/data/icon/icon.jpg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a2e" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Inline script to apply theme color before React hydration
  const themeScript = `
    (function() {
      var adsFeatureEnabled = ${ADS_FEATURE_ENABLED ? "true" : "false"};
      var showAds = ${DEFAULT_SHOW_ADS ? "true" : "false"};

      if (adsFeatureEnabled) {
        try {
          var savedShowAds = localStorage.getItem('${SHOW_ADS_STORAGE_KEY}');
          if (savedShowAds === 'true') showAds = true;
          if (savedShowAds === 'false') showAds = false;
        } catch (e) {}
      } else {
        showAds = false;
      }

      document.documentElement.dataset.showAds = showAds ? 'true' : 'false';

      if (showAds && !document.getElementById('${ADSENSE_SCRIPT_ID}')) {
        var adsenseScript = document.createElement('script');
        adsenseScript.id = '${ADSENSE_SCRIPT_ID}';
        adsenseScript.async = true;
        adsenseScript.crossOrigin = 'anonymous';
        adsenseScript.src = '${ADSENSE_SCRIPT_SRC}';
        document.head.appendChild(adsenseScript);
      }

      try {
        var savedColorSchemePreference = localStorage.getItem('${COLOR_SCHEME_STORAGE_KEY}');
        var colorSchemePreference =
          savedColorSchemePreference === 'light' ||
          savedColorSchemePreference === 'dark' ||
          savedColorSchemePreference === 'system'
            ? savedColorSchemePreference
            : 'system';
        var prefersDark = window.matchMedia('${DARK_MEDIA_QUERY}').matches;
        var resolvedColorScheme =
          colorSchemePreference === 'system'
            ? (prefersDark ? 'dark' : 'light')
            : colorSchemePreference;

        document.documentElement.dataset.theme = resolvedColorScheme;
        document.documentElement.dataset.themePreference = colorSchemePreference;
        document.documentElement.style.colorScheme = resolvedColorScheme;
        document.documentElement.classList.toggle('dark', resolvedColorScheme === 'dark');

        var charColors = {
          "1": "#33aaee", "2": "#ffdd44", "3": "#ee6666", "4": "#BBDD22",
          "5": "#FFCCAA", "6": "#99CCFF", "7": "#ffaacc", "8": "#99EEDD",
          "9": "#ff6699", "10": "#00BBDD", "11": "#ff7722", "12": "#0077DD",
          "13": "#FFBB00", "14": "#FF66BB", "15": "#33DD99", "16": "#BB88EE",
          "17": "#bb6688", "18": "#8888CC", "19": "#CCAA88", "20": "#DDAACC",
          "21": "#33ccbb", "22": "#ffcc11", "23": "#FFEE11", "24": "#FFBBCC",
          "25": "#DD4444", "26": "#3366CC"
        };
        var savedCharId = localStorage.getItem('${THEME_CHAR_STORAGE_KEY}');
        if (savedCharId && charColors[savedCharId]) {
          var color = charColors[savedCharId];
          document.documentElement.style.setProperty('--color-miku', color);
          // Darken for dark variant
          var num = parseInt(color.replace('#', ''), 16);
          var amt = Math.round(2.55 * 15);
          var R = Math.max((num >> 16) - amt, 0);
          var G = Math.max(((num >> 8) & 0x00ff) - amt, 0);
          var B = Math.max((num & 0x0000ff) - amt, 0);
          var darkColor = '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
          document.documentElement.style.setProperty('--color-miku-dark', darkColor);
          // Light variant for background
          var rr = (num >> 16) & 0xff;
          var gg = (num >> 8) & 0xff;
          var bb = num & 0xff;
          var factor = 0.95;
          var newR = Math.round(rr * (1 - factor) + 255 * factor);
          var newG = Math.round(gg * (1 - factor) + 255 * factor);
          var newB = Math.round(bb * (1 - factor) + 255 * factor);
          var lightColor = '#' + ((1 << 24) + (newR << 16) + (newG << 8) + newB).toString(16).slice(1);
          document.documentElement.style.setProperty('--theme-light', lightColor);

          document.documentElement.style.setProperty('--color-miku-rgb', rr + ', ' + gg + ', ' + bb);
        }
      } catch(e) {}
    })();
  `;

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`antialiased`}
      >
        <ThemeProvider>
          <MasterDataProvider>
            <TranslationProvider>
              <QuickFilterProvider>
                <BreadcrumbProvider>
                  {children}
                </BreadcrumbProvider>
              </QuickFilterProvider>
            </TranslationProvider>
          </MasterDataProvider>
        </ThemeProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
