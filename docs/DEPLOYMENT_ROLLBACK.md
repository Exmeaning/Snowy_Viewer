# Website Deployment Rollback

This runbook covers the Moesekai Next.js standalone application and Go API.
It does not authorize publishing or changing the NEXTmoetranslation producer.

## Rollback Triggers

Rollback when health checks fail, error rates rise materially, locale routes
serve the wrong region, published lyrics disappear unexpectedly, or the Go
proxy cannot reach the Next.js process. Treat a producer/consumer contract
mismatch as a fail-closed incident; do not expose unvalidated lyrics bytes.

## Before Deployment

1. Record the current Git commit and immutable image digest.
2. Record the previous known-good commit and image digest.
3. Run the CI commands from `.github/workflows/ci.yml`.
4. Regenerate sitemap data with `npm run --prefix web sitemap` and inspect all
   five `web/public/data/sitemap-data.*.json` files. Public Lyrics is a
   fail-closed source: set `NEXT_PUBLIC_LYRICS_BASE_URL` and
   `REQUIRE_PUBLIC_LYRICS_SOURCE=1`, and stop if the source is unavailable or
   invalid. Do not rely on `REQUIRE_FRESH_BUILD_DATA=1` for this contract; it
   does not make the fail-closed lyrics source succeed. Never commit a degraded,
   silently stale, or route-dropping regeneration.
5. Record the exact NEXT Public Lyrics v3 candidate manifest, receipt, content
   SHA-256, and producer database SHA-256 that the website will consume.
6. Strictly decode the v3 index, one `complete` detail, and one top-level
   `game_only` detail. Confirm each detail has the same revision, state, and
   `availableVersions` as its index entry, and that an `incomplete` entry has no
   detail artifact.
7. Exercise the previous known-good image digest against that same immutable v3
   candidate before rollout. If it cannot strictly consume the active producer,
   it is not a valid rollback target; retain the last verified v3-compatible
   image or prepare a fix-forward image instead.

## Rollback Procedure

1. Stop rollout and retain logs from both processes.
2. Redeploy the previous known-good **v3-compatible** image by digest, not a
   mutable tag. Do not place a v1-only image in front of the active v3 producer;
   if no compatible rollback image exists, keep the current image isolated and
   fix forward.
3. If deployment is Git-based, revert the faulty deployment commit with a new
   commit. Do not rewrite shared branch history.
4. Restore the previous sitemap artifacts only when the failed release changed
   route data and the prior files match the restored application version.
5. Do not roll back or hand-edit NEXT lyrics artifacts from this repository.
   The website must continue to fail closed on an unavailable or invalid index.

## Validation

Verify `/`, `/api/card-event-map`, and locale-prefixed list pages. Verify one
published `/lyrics/{musicId}` page has canonical metadata, BreadcrumbList and
MusicRecording JSON-LD, a visible attribution, and translated lines. Verify one
published top-level `game_only` detail renders only Game content and remains
strictly aligned with its index entry. Verify an incomplete/unpublished ID
remains noindex/notFound with no detail summary or structured data. Check logs
for upstream timeouts, oversized masterdata rejection, proxy errors, and
repeated translation validation failures.

## Forward Recovery

Identify the failing commit, producer revision, region, and first error time.
Fix forward through the normal review and CI path, then deploy a new immutable
image. Record the rollback and recovery commits, image digests, validation
results, and whether sitemap outputs were unchanged, freshly regenerated, or
intentionally retained because a source was stale.
