"use client";

import { useRef } from "react";
import { useServerInsertedHTML } from "next/navigation";

interface RootHeadScriptsProps {
  navigationJsonLd: string;
  themeScript: string;
  videoGameJsonLd: string;
  websiteJsonLd: string;
  googleTagScript?: string;
}

export default function RootHeadScripts({
  navigationJsonLd,
  themeScript,
  videoGameJsonLd,
  websiteJsonLd,
  googleTagScript,
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
        {googleTagScript && (
          <script
            id="moesekai-google-tag-bootstrap"
            dangerouslySetInnerHTML={{ __html: googleTagScript }}
          />
        )}
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
