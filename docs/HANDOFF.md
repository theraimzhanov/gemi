# Gemi handoff

Gemi is an AI stylist built for HackUTA 2026. Users upload a photo of themselves, apply clothing references, shop by text/voice, or try on community looks.

## Run and verify

1. `npm install` (Node 24+ for the TypeScript and offline route-test loader; the current machine uses Node 26).
2. Keep `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, and `DATABASE_URL` in ignored `.env.local`. Never commit keys.
3. Run `node --env-file=.env.local scripts/setup-db.ts` before using this branch. This adds `users.preferences` and a jobs lookup index; it does not reset data. The migration has been applied to the configured development database.
4. `npm run dev` (the existing local server is on port 3000).
5. `npm test`, `npm run lint`, and `npm run build` require no paid generations. `npm run test:db` needs the running local server and the configured database; it creates isolated fixtures and removes them in `finally`.

Optional `DAILY_JOB_LIMIT` defaults to **10 requests per user in a rolling 24 hours**. Searches, confirmations, edits, similar-look requests, community try-ons, and failed attempts all count. Search plus confirmation uses two requests. Reservations are serialized per user before provider calls. This is a request cap, not an exact dollar cap or protection against creating multiple accounts.

## Changes on codex/hackathon-styling-fixes

The branch must remain unmerged until the owner approves it.

| Original gap | Current behavior |
| --- | --- |
| Single-product photo replaces everything | Extraction distinguishes featured products from outfits. Generation targets the detected categories and explicitly preserves unrelated pieces, including other accessories. |
| Only one attachment | Up to 13 reference photos plus the user's photo. Uploads are resized, removable individually, and checked against a combined payload limit. |
| Text and photos ignored one another | Intent routing sees all references; extraction and generation receive the instructions. Voice instructions are passed through the intent result. |
| No product choice | Search returns up to three options per category with available photos, prices and store links. Only **Try these on** starts generation. Server checks the caller-owned saved search and selected indices; choices expire after 24 hours. |
| Budget not enforced | Integer-cent checks validate a complete selection before previews and again before generation. An unaffordable/incomplete search is retried once for cheaper items; otherwise it fails clearly. Budget applies to selected purchases before tax/shipping, not the value of previously worn clothes. |
| Likes not used | **For you** ranks by distance to the average embedding of liked, shared looks, falling back to Trending when there is no taste vector. Recent liked looks also inform shopping. |
| Edited receipt stale | Photo applications and micro-edits re-extract the rendered outfit. Prices after edits are estimates; stale store links are discarded. The final rendered image becomes the reference for future community try-ons. |
| No shopping profile | Optional department/gender, sizes and style are saved in Profile and included in shopping. Explicit requests take priority. Size/stock must still be checked with the retailer. |
| No spending control | The shared jobs reservation enforces the rolling per-user cap, including concurrent calls and community try-ons. |

Product preview downloads validate public HTTPS destinations, pin public IPv4 DNS results, revalidate redirects, and cap response sizes. Missing or blocked retailer photos show a labeled placeholder; generation can fall back to descriptions.

## Main files

- `lib/gemini.ts`: Gemini text/image/embedding calls; multimodal intent, extraction, shopping alternatives, try-ons and edits. OpenRouter text calls fall back to Google. Shopping gets a longer response timeout than ordinary text requests.
- `lib/styling.ts`: shared shopping types, selection/budget validation, attachment limits.
- `lib/product-image.ts`: bounded public retailer image downloads.
- `app/api/chat/route.ts`: validates uploads, loads owned current looks, creates shopping previews, validates confirmations, then generates.
- `app/(app)/studio/choices.tsx`: accessible product radio groups and budget-aware confirmation.
- `lib/jobs.ts`, `lib/job-limit.ts`: asynchronous jobs and atomic request reservations.
- `app/api/profile/route.ts`, `app/(app)/profile/`: saved preferences.
- `app/api/looks/route.ts`, `app/(app)/feed/page.tsx`: personalized community order.
- `scripts/check.ts`, `scripts/check-routes.mjs`, `scripts/check-product.mjs`, `scripts/check-db.ts`: offline provider/route checks and isolated database/API integration checks.

Routes use `maxDuration = 300`; `after()` is still subject to the hosting platform's function limit. Polling lasts a little over five minutes. This is not a durable job queue. Check the deployment plan's timeout before publishing.

## Verification and remaining limits

Verified during this pass: production build, TypeScript, lint, deterministic provider/route tests, database/API tests (including concurrent cap and account isolation), actual browser selfie upload and four-photo attachment/removal, profile preference save, live shopping alternatives and selection totals, and one live photo-plus-text try-on. In that try-on only the requested top changed; jeans and sneakers were retained, and the receipt described the result.

The first live shopping attempt got an unusable OpenRouter response followed by Google's quota limit. Search timeout and public error handling were improved; the retry returned three products under $100 and waited for confirmation. A final browser search displayed a real retailer preview after fixing bounded metadata reads and resizing photos with the already-installed Sharp library (now an explicit dependency). Provider availability and retailer bot restrictions can still interrupt searches or previews. Automated tests verify budget re-search, choice validation and generation only after confirmation.

Generative edits are best-effort: a passing example cannot guarantee exact identity, product fidelity, or preservation on every image. Product prices and stock come from web search, not retailer checkout APIs. Hardware microphone recording, a live four-product composite, a live full $500 outfit, and deployment remain unverified.

Unchanged backlog: chat history disappears on reload; selfies are browser-local; no delete/unshare/unlike; no password reset, email verification or login rate limit. Timescale CA expires in October 2027. These are outside the nine handoff fixes.
