import type { Metadata } from "next";

import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { MasterDataProvider } from "@/contexts/MasterDataContext";
import { TranslationProvider } from "@/contexts/TranslationContext";



export const metadata: Metadata = {
  title: "Snowy SekaiViewer",
  description: "Project Sekai Viewer",
  icons: {
    icon: "/data/icon/icon.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Inline script to apply theme color before React hydration
  const themeScript = `
    (function() {
      try {
        var charColors = {
          "1": "#33aaee", "2": "#ffdd44", "3": "#ee6666", "4": "#BBDD22",
          "5": "#FFCCAA", "6": "#99CCFF", "7": "#ffaacc", "8": "#99EEDD",
          "9": "#ff6699", "10": "#00BBDD", "11": "#ff7722", "12": "#0077DD",
          "13": "#FFBB00", "14": "#FF66BB", "15": "#33DD99", "16": "#BB88EE",
          "17": "#bb6688", "18": "#8888CC", "19": "#CCAA88", "20": "#DDAACC",
          "21": "#33ccbb", "22": "#ffcc11", "23": "#FFEE11", "24": "#FFBBCC",
          "25": "#DD4444", "26": "#3366CC"
        };
        var savedCharId = localStorage.getItem('theme-char-id');
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
        }
      } catch(e) {}
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`antialiased`}
      >
        <ThemeProvider>
          <MasterDataProvider>
            <TranslationProvider>
              {children}
            </TranslationProvider>
          </MasterDataProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

