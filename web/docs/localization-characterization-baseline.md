# Localization and Lyrics Characterization Baseline

Captured on 2026-07-22 at source commit `fdadfb9`, before adding locale-specific dynamic overlays, locale-aware cache keys, remote UI bundles, search `en` fields, or lyrics routes.

## Executable Baseline

The tests live in `web/tests/characterization/` and use the immutable representative fixture `web/tests/fixtures/localization-baseline.json`. They use Node's native test runner and built-in TypeScript stripping so the baseline remains executable even when Bun and frontend dependencies are unavailable:

```sh
node --test web/tests/characterization/*.test.mjs
```

The fixture intentionally contains a small representative subset rather than a mirror of mutable production data. The music and event-story examples preserve the deployed source-string-keyed shapes observed at `translation.exmeaning.com` on the capture date; the search-index rows are representative consumer-schema data because the endpoint returned an identity-verification page during audit.

## Current Contracts

| Surface | Characterized behavior |
| --- | --- |
| Dynamic translation bundle | Thirteen fixed JSON files under `https://translation.exmeaning.com/translation`; source text is the map key; intended output is zh-CN. |
| `TranslationData` | Fixed category/field maps. Remote cards currently include `gachaPhrase`, but the TypeScript interface omits it. Several declared maps are not consumed by the UI. |
| `TranslationContext.t` | Returns `null` while the setting is off, data/category/field is absent, or translated/original text is equal after trimming; otherwise returns the mapped value. |
| `TranslatedText` | Original-only fallback, parenthesized inline mode, and original-over-translation stacked mode. The hook delegates to the same `t(category, field, original)` call. |
| Translation setting | `use-llm-translation` explicitly overrides defaults. Without an override, SSR begins enabled and hydration enables only a zh-CN UI locale. Enabling it under another UI locale still shows the same zh-CN overlay. |
| Bundle cache | Fresh memory wins, then an IndexedDB bundle, then network. The IDB key is `translations-bundle`; its hash is `masterdata-version:translation-data-version`; TTL is 30 minutes; stale memory/IDB is returned while a background refresh runs. |
| IndexedDB | Database `snowy-cache`, version 1, stores `masterdata` and `translations`, both keyed by `path`. Hash mismatch is a miss. Failed reads return `null`; writes and clears log and resolve. |
| Event stories | Per-event no-store fetch, in-flight request deduplication, nonempty-success memory caching, legacy-map conversion to `official_cn`, and retry after missing/empty/failure. |
| Story merge/display | `cnBody` and `cnDisplayName` are looked up by the complete original body/name string. Only Talk actions are merged. Both secondary fields are shown only when `useLLMTranslation` is on and trimmed text differs. |
| Route locale | `zh-cn`, `zh-tw`, `ja-jp`, `en-us`, and `ko-kr` map to matching UI locale/server/asset regions. Unknown or unprefixed routes fall back to zh-CN/CN. Localized links preserve the active route prefix. |
| Search | Shared index schema is `id`, `n`, optional `cn`, `g`, and optional card `c`; there is no `en`. Music list search also includes credits and separately sourced community aliases. |
| Music list/item/detail | Two-column mobile grid expands at `sm`, `md`, and `lg`; detail becomes two-column and sticky only at `lg`. `MusicItem` uses `LocalizedLink`, shows original title first, prefers the legacy translation map over search-index `cn`, and contains existing dark utility classes. Detail has no lyrics section. |
| Character colors | `CHAR_COLORS` is defined in `web/src/types/types.ts`; `ThemeContext` imports and re-exports that same object. |
| UI i18n/SEO | Five UI bundles have 3,306 matching keys/interpolation tokens. Literal usage and the current hardcoded allowlist pass. SEO registry has 46 indexable and 18 noindex routes; music list and detail use the existing server metadata wrappers. |

## Storage Baseline

Translation and locale work must account for these current keys before changing cache identity or migration behavior:

| Storage | Keys |
| --- | --- |
| localStorage | `masterdata-version`, `translation-cache-time`, `translation-data-version`, `use-llm-translation`, `moesekai_ui_locale`, `server-source`, `asset-source` |
| sessionStorage | `music_filters`, `music_scroll`, `music_displayCount` |
| IndexedDB | `snowy-cache` / `translations` / `translations-bundle` |

## Audit-Grounded Gaps

- The current dynamic overlay is zh-CN-only, source-string keyed, and collision-prone; it is not an ID-based multilingual contract.
- `music.artist` and several MySekai maps are declared but not wired. `cards.gachaPhrase` is present remotely but absent from `TranslationData`.
- Global search and music search expose only original `n` plus Chinese `cn`; aliases are third-party user data and are not translations.
- Story translation covers event Talk body/display names only. It has no stable line index/source hash and does not cover all story families or special-effect text.
- Music detail has responsive/dark behavior and translated title support, but no lyrics data model, route, rights metadata, or UI.
- Current hardcoded-text scanning is Han-focused and does not comprehensively detect English, Japanese, Korean, or accessibility attributes.

## Verification Record

The command table below records this independent worktree's baseline. Exit code 127 means the requested executable was not installed; no result is inferred from an unavailable command.

| Command | Exit | Result |
| --- | ---: | --- |
| `node --test web/tests/characterization/*.test.mjs` | 0 | 25 passed, 0 failed. Node 24 reports `stripTypeScriptTypes` as experimental. |
| `go test ./...` | 1 | Internal packages ran, but the root package setup fails because `Dockerfile.go:1` begins with the Dockerfile comment character `#` and is parsed as Go source. |
| `go test ./internal/...` | 0 | `internal/htmlcache` and `internal/middleware` passed; other internal packages have no test files. |
| `npm test --workspace sekai-calculator -- --runInBand` | 127 | Repository reference tests could not start because `jest` is not installed in this worktree. |
| `bun run --cwd web lint:i18n` | 127 | Bun unavailable (`command not found`). |
| `bun run --cwd web lint:i18n-usage` | 127 | Bun unavailable (`command not found`). |
| `bun run --cwd web lint` | 127 | Bun unavailable (`command not found`). |
| `bun run --cwd web build:next` | 127 | Bun unavailable (`command not found`). |
| `node web/scripts/check-i18n-keys.mjs` | 0 | 3,306 keys and interpolation tokens match across five locales. |
| `node web/scripts/check-i18n-usage.mjs` | 0 | Literal i18n usage keys pass. |
| `node web/scripts/scan-hardcoded-ui-text.mjs` | 0 | Han scan passes with 24 allowlisted file groups. |
| `node web/scripts/check-seo-routes.mjs` | 0 | SEO registry passes with 46 indexable and 18 noindex routes. |

## Scope Boundary

This baseline adds tests, fixtures, and documentation only. It deliberately does not add en-US overlays, cache-key changes, `en` search fields, lyrics modules/routes, remote UI message loading, or any runtime behavior.
