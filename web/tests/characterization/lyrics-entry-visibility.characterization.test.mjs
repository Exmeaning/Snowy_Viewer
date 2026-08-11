import assert from "node:assert/strict";
import test from "node:test";

import { importWebTypeScript, readWeb } from "./test-helpers.mjs";

async function importNavigation(lyricsEntryVisible) {
  return importWebTypeScript("src/lib/navigation.ts", [
    [
      'import { stripRouteLocale } from "@/lib/localized-path";',
      'const stripRouteLocale = (pathname) => pathname.replace(/^\\/(?:zh-cn|zh-tw|en-us|ja-jp|ko-kr)(?=\\/|$)/, "") || "/";',
    ],
    [
      'import { LYRICS_ENTRY_VISIBLE } from "@/lib/lyrics-visibility";',
      `const LYRICS_ENTRY_VISIBLE = ${lyricsEntryVisible};`,
    ],
  ]);
}

test("lyrics entry points default to hidden while direct route metadata remains available", async () => {
  const visibility = await importWebTypeScript("src/lib/lyrics-visibility.ts");
  assert.equal(visibility.LYRICS_ENTRY_VISIBLE, false);

  const navigation = await importNavigation(false);
  const database = navigation.navigationGroups.find((group) => group.href === "/breadcrumb-database");
  assert.ok(database);
  assert.equal(database.items.some((item) => item.href === "/lyrics"), false);
  assert.equal(navigation.searchableNavItems.some((item) => item.href === "/lyrics"), false);

  const musicMatch = navigation.findNavMatch("/en-us/music/39");
  assert.equal(musicMatch?.item.href, "/music");
  assert.equal(musicMatch?.group.items.some((item) => item.href === "/lyrics"), false);

  const lyricsMatch = navigation.findNavMatch("/zh-cn/lyrics/39");
  assert.equal(lyricsMatch?.item.href, "/lyrics");
  assert.equal(
    lyricsMatch?.group.items.some((item) => item.href === "/lyrics"),
    true,
    "a known direct lyrics URL must retain its own breadcrumb identity",
  );
});

test("the manual launch switch restores all discoverable lyrics entry points", async () => {
  const navigation = await importNavigation(true);
  const database = navigation.navigationGroups.find((group) => group.href === "/breadcrumb-database");
  assert.ok(database?.items.some((item) => item.href === "/lyrics"));
  assert.ok(navigation.searchableNavItems.some((item) => item.href === "/lyrics"));
  assert.ok(navigation.findNavMatch("/music/39")?.group.items.some((item) => item.href === "/lyrics"));
});

test("sidebar and music detail honor the switch without removing lyrics routes", () => {
  const sidebar = readWeb("src/components/Sidebar.tsx");
  const musicDetail = readWeb("src/app/music/[id]/client.tsx");

  assert.match(sidebar, /LYRICS_ENTRY_VISIBLE \? \[\{[\s\S]*?href: "\/lyrics"[\s\S]*?\}\] : \[\]/);
  assert.match(musicDetail, /if \(!LYRICS_ENTRY_VISIBLE\) return;/);
  assert.match(musicDetail, /LYRICS_ENTRY_VISIBLE && hasPublishedLyrics/);
  assert.match(readWeb("src/app/lyrics/page.tsx"), /LyricsClient/);
  assert.match(readWeb("src/app/lyrics/[musicId]/page.tsx"), /LyricsDetailClient/);
  assert.match(readWeb("src/lib/seo-routes-data.json"), /"path": "\/lyrics\/"/);
});
