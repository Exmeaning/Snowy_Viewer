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
   five `web/public/data/sitemap-data.*.json` files. The generator preserves
   existing detail routes when a source is unavailable unless
   `REQUIRE_FRESH_BUILD_DATA=1`; never commit a degraded or silently stale
   regeneration.
5. Confirm the NEXT public lyrics index and one detail fixture satisfy the
   committed v1 consumer contract before switching traffic.

## Rollback Procedure

1. Stop rollout and retain logs from both processes.
2. Redeploy the previous known-good image by digest, not a mutable tag.
3. If deployment is Git-based, revert the faulty deployment commit with a new
   commit. Do not rewrite shared branch history.
4. Restore the previous sitemap artifacts only when the failed release changed
   route data and the prior files match the restored application version.
5. Do not roll back or hand-edit NEXT lyrics artifacts from this repository.
   The website must continue to fail closed on an unavailable or invalid index.

## Validation

Verify `/`, `/api/card-event-map`, and locale-prefixed list pages. Verify one
published `/lyrics/{musicId}` page has canonical metadata, BreadcrumbList and
MusicRecording JSON-LD, a visible attribution, and translated lines. Verify an
unpublished ID remains noindex/notFound with no detail summary or structured
data. Check logs for upstream timeouts, oversized masterdata rejection, proxy
errors, and repeated translation validation failures.

## Forward Recovery

Identify the failing commit, producer revision, region, and first error time.
Fix forward through the normal review and CI path, then deploy a new immutable
image. Record the rollback and recovery commits, image digests, validation
results, and whether sitemap outputs were unchanged, freshly regenerated, or
intentionally retained because a source was stale.
