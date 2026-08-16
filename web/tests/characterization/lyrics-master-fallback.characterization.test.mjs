import assert from "node:assert/strict";
import test from "node:test";

import { importWebTypeScript, readWeb } from "./test-helpers.mjs";

test("published lyrics merge missing JP music metadata without replacing regional records", async () => {
  const catalog = await importWebTypeScript("src/lib/lyrics-music-catalog.ts");
  const current = [{ id: 307, title: "regional", categories: [{ musicCategoryName: "mv" }] }];
  const japanese = [
    { id: 307, title: "japanese", categories: ["mv"] },
    { id: 754, title: "光", categories: [{ musicCategoryName: "image" }] },
    { id: 765, title: "レム", categories: ["mv"] },
    { id: 789, title: "incomplete", categories: ["mv"] },
  ];

  const merged = catalog.mergePublishedLyricsMusicCatalog(current, japanese, new Set([307, 754, 765]));
  assert.deepEqual(merged.map((music) => music.id), [307, 754, 765]);
  assert.equal(merged[0].title, "regional", "current-region metadata must win for duplicate IDs");
  assert.deepEqual(merged[0].categories, ["mv"]);
  assert.deepEqual(merged[1].categories, ["image"]);
  assert.equal(catalog.findLyricsMusic(754, current, japanese)?.title, "光");
  assert.equal(catalog.findLyricsMusic(307, current, japanese)?.title, "regional");
  assert.equal(catalog.findLyricsMusic(999, current, japanese), null);
});

test("lyrics pages use a current-region-first JP fallback only for published lyrics metadata", () => {
  const source = readWeb("src/lib/lyrics-music-source.ts");
  assert.match(source, /fetchMasterData<IMusicInfo\[]>\("musics\.json"\)/);
  assert.match(source, /fetchMasterDataForServer<IMusicInfo\[]>\("jp", "musics\.json"\)/);
  assert.match(source, /every\(\(musicId\) => currentRegionIds\.has\(musicId\)\)/);
  assert.match(source, /mergePublishedLyricsMusicCatalog\(currentRegionMusics, japaneseMusics, publishedMusicIds\)/);
  assert.match(source, /catch \{[\s\S]*return currentRegionMusics\.map\(normalizeLyricsMusic\)/);

  const list = readWeb("src/app/lyrics/client.tsx");
  assert.match(list, /fetchLyricsMusicCatalog\(new Set\(\)\)/);
  assert.match(list, /setMusics\(musicData\)/);

  const detail = readWeb("src/app/lyrics/\[musicId\]/client.tsx");
  assert.match(detail, /fetchLyricsMusicById\(musicId\)/);
  assert.doesNotMatch(detail, /fetchMasterData<IMusicInfo\[]>\("musics\.json"\)/);
});
