"use client";

import { useRef } from "react";
import { useServerInsertedHTML } from "next/navigation";

interface RootHeadScriptsProps {
  navigationJsonLd: string;
  themeScript: string;
  videoGameJsonLd: string;
  websiteJsonLd: string;
}

export default function RootHeadScripts({
  navigationJsonLd,
  themeScript,
  videoGameJsonLd,
  websiteJsonLd,
}: RootHeadScriptsProps) {
  const inserted = useRef(false);

  useServerInsertedHTML(() => {
    if (inserted.current) return null;
    inserted.current = true;

    return (
      <>
        <script
          id="moesekai-theme-bootstrap"
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
        <script
          id="moesekai-website-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: websiteJsonLd }}
        />
        <script
          id="moesekai-videogame-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: videoGameJsonLd }}
        />
        <script
          id="moesekai-navigation-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: navigationJsonLd }}
        />
      </>
    );
  });

  return null;
}
