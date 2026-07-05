import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import Script from "next/script";

import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { I18nProvider } from "@/contexts/I18nContext";
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
import { generateRootMetadata, getSiteBaseUrl } from "@/lib/seo-metadata";
import { generateRootJsonLd, generateSiteNavigationItemListJsonLd } from "@/lib/structured-data";
import { buildGoogleTagBootstrapScript } from "@/lib/googleTag";
import {
  SUPPORTED_UI_LOCALES,
  UI_LOCALE_HTML_LANG,
  UI_LOCALE_STORAGE_KEY,
  resolveAcceptLanguageUiLocale,
  resolveUiLocale,
} from "@/lib/i18n";
import { BACKGROUND_ANIMATION_BUDGET_STORAGE_KEY } from "@/lib/backgroundAnimation";

const SITE_BASE_URL = getSiteBaseUrl();
const googleTagScript = buildGoogleTagBootstrapScript();

export async function generateMetadata(): Promise<Metadata> {
  return generateRootMetadata();
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a2e" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const initialUiLocale =
    resolveUiLocale(cookieStore.get(UI_LOCALE_STORAGE_KEY)?.value) ??
    resolveAcceptLanguageUiLocale(requestHeaders.get("accept-language"));
  const jsonLd = generateRootJsonLd(SITE_BASE_URL, initialUiLocale);
  const navigationJsonLd = generateSiteNavigationItemListJsonLd(SITE_BASE_URL, initialUiLocale);
  const supportedUiLocales = JSON.stringify(SUPPORTED_UI_LOCALES);
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

      try {
        var savedBackgroundAnimationBudget = localStorage.getItem('${BACKGROUND_ANIMATION_BUDGET_STORAGE_KEY}');
        var backgroundAnimationBudget = savedBackgroundAnimationBudget === 'off' ? 'off' : 'on';
        document.documentElement.dataset.backgroundAnimation = backgroundAnimationBudget;
      } catch (e) {
        document.documentElement.dataset.backgroundAnimation = 'on';
      }

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

      try {
        var supportedUiLocales = ${supportedUiLocales};
        var savedUiLocale = localStorage.getItem('${UI_LOCALE_STORAGE_KEY}');
        var browserUiLocales = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
        var localeCandidates = savedUiLocale ? [savedUiLocale] : browserUiLocales;
        var resolvedUiLocale = '${initialUiLocale}';
        for (var i = 0; i < localeCandidates.length; i++) {
          var normalizedUiLocale = String(localeCandidates[i] || '').toLowerCase();
          var matchedUiLocale = supportedUiLocales.find(function(locale) {
            return normalizedUiLocale === locale.toLowerCase() || normalizedUiLocale.split('-')[0] === locale.toLowerCase().split('-')[0];
          });
          if (matchedUiLocale) {
            resolvedUiLocale = matchedUiLocale;
            break;
          }
        }
        document.documentElement.lang = resolvedUiLocale;
        document.documentElement.dataset.uiLocale = resolvedUiLocale;
      } catch (e) {}
    })();
  `;

  return (
    <html
      lang={UI_LOCALE_HTML_LANG[initialUiLocale]}
      data-ui-locale={initialUiLocale}
      suppressHydrationWarning
    >
      <head>
        <meta name="color-scheme" content="light dark" />
      </head>
      <body className="font-sans">
        <Script id="moesekai-theme-bootstrap" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Script id="moesekai-google-tag-bootstrap" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: googleTagScript }} />
        <Script
          id="moesekai-website-jsonld"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd.website) }}
        />
        <Script
          id="moesekai-videogame-jsonld"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd.videoGame) }}
        />
        <Script
          id="moesekai-navigation-jsonld"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(navigationJsonLd) }}
        />
        <ThemeProvider>
          <I18nProvider initialLocale={initialUiLocale}>
            <MasterDataProvider>
              <TranslationProvider>
                <QuickFilterProvider>
                  <BreadcrumbProvider>
                    {children}
                  </BreadcrumbProvider>
                </QuickFilterProvider>
              </TranslationProvider>
            </MasterDataProvider>
          </I18nProvider>
        </ThemeProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
