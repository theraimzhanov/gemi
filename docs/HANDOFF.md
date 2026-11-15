# Gemi handoff notes

Gemi is an AI stylist: a user adds a photo of themselves, then copies an outfit from a photo, shops by text or voice, or tries on a community look. Built for HackUTA 2026 (prizes targeted: Best Use of Gemini API, Best Use of Tiger Data).

## Run it
1. `npm install`
2. Create `.env.local` with `GEMINI_API_KEY` (Google AI Studio, free tier), `OPENROUTER_API_KEY` (needs paid credits; pictures cost about 7 cents a look), `DATABASE_URL` (Tiger Data / Timescale Postgres).
3. `node --env-file=.env.local scripts/setup-db.ts` creates the tables; `node --env-file=.env.local scripts/seed.ts` fills the community with the 12 demo looks.
4. `npm run dev`

Never commit `.env.local`. This is a newer Next.js than most documentation describes; read `node_modules/next/dist/docs/` before changing routing or data fetching (see `AGENTS.md`).

## How it works
- `lib/gemini.ts` — every model call. Text calls (`routeIntent`, `extractGarments`, `shopGarments`) go to `google/gemini-3.8-flash` on OpenRouter first and fall back to Google. Pictures (`generateTryOn`, `editLook`) go to `google/gemini-nano-banana-2.1` on OpenRouter. Embeddings use Google.
- `lib/jobs.ts` — a request inserts a row in `jobs`, answers with the job id, and does the work after the response. `app/api/jobs/[id]/route.ts` is polled by `postJob` in `lib/client.ts`.
- `app/api/chat/route.ts` — routes a request to one of: `steal_look`, `shop_and_dress`, `micro_edit`, `find_similar`.
- `lib/looks.ts` — `saveLook` stores every generated look as private; sharing is `POST /api/looks`.
- `lib/auth.ts`, `lib/password.ts` — email login, scrypt hashes, session cookie.
- Screens: `app/page.tsx` (landing), `app/login`, and `app/(app)/` for `studio` (chat), `feed`, `looks`, `profile`.
- `db/schema.sql` — `looks`, `garment_refs`, `look_events` (hypertable, drives Trending), `users`, `sessions`, `jobs`. `looks.embedding` (pgvector) drives similar looks.

## Verified working (in the browser, with real pictures)
Sign-up and login, "Try on me" from the community, a one-piece edit in chat, shopping from text with a real store link, similar looks, sharing, likes (one per user), My looks, Profile.

## Known gaps, in suggested order
1. **One product photo changes the whole outfit.** A photo with no text always goes to `steal_look`. If the photo shows one or two pieces, change only those categories; `generateTryOn` already takes `onlyCategories`.
2. **Only one photo can be attached.** Allow several in `app/(app)/studio/page.tsx` and the chat route; read garments from each and pass all as references (the picture model accepts up to 14).
3. **Text and photo are not combined.** `routeIntent` is told a photo exists but never sees it, and `generateTryOn` never sees the user's words.
4. **No "is this the one you wanted?" step.** Shopping picks one item per category and generates at once. Offer about 3 candidates with photo, price and link, and generate after the user picks.
5. **Budget is requested, not enforced.** Check the total in `shopGarments` and drop or re-search the priciest item.
6. **Likes do not personalise anything.** Use the embeddings of liked looks for a "For you" order and to bias shopping.
7. **Receipt does not follow a small edit.** After `micro_edit`, re-read garments with `extractGarments`.
8. **Shopping ignores who the user is.** A women's shirt was picked for a man. Store gender, size and style on Profile and add them to the shopping request.
9. **No spending limit per user.** Add a daily cap counted from `jobs` before publishing; every look spends OpenRouter credit.

## Untested
Voice requests, the file-upload buttons (tests injected the photo directly), a full "$500 outfit" request, a production build, and publishing on Vercel (set the three env vars there; check the function time limit against `maxDuration = 120`).

## Smaller known limits
No delete, unshare or unlike. Chat history is lost on reload (looks stay in My looks). The user's own photo is kept in one browser's localStorage. No password reset, email verification or login rate limit. Web-search store links are sometimes Google redirect links that may expire. `lib/timescale-ca.ts` pins Timescale's CA, which expires in October 2027.
