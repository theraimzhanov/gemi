# Gemi

Gemi is an AI stylist. Upload a photo of yourself, then try clothes on it: from reference photos, from a text or voice request, from a shopping search with a budget, or from looks other people shared.

Built at **HackUTA 2026** (November 14–15, 2026) during the 24-hour hacking window.

## What it does

- **Try-on from photos.** Add up to 13 reference photos of clothes. Gemi changes only the pieces you asked for and keeps the rest of your outfit.
- **Shop by text or voice.** Say "a fall outfit under $100". Gemi searches the web, offers up to three real products per category with photo, price and store link, checks them against your budget, and renders the try-on only after you pick.
- **Small edits.** "Make the jacket black" re-renders the look and updates the receipt.
- **Community feed.** Share a look, like others, and try a shared look on yourself. The **For you** tab ranks looks by similarity to the ones you liked.
- **Profile.** Saved sizes, department and style are used in every shopping search.
- **Saved plans.** Save a request to run on a date; a daily cron job runs it.
- **Background jobs.** Every request is a job stored in the database, so you can leave the page and come back to the result and the chat history.

## Tools used

### AI coding tools

| Tool | How we used it |
| --- | --- |
| **Claude Code** | Main coding agent. Wrote most of the app: the Gemini pipeline, database schema, auth, jobs, screens and tests. Its commits carry a `Co-Authored-By: Claude` line. |
| **OpenAI Codex** | Second agent for a review-and-fix pass on the `codex/hackathon-styling-fixes` branch (merged as PR #1): multi-photo uploads, product choices, budget checks, personalization and usage limits. |

### AI models and APIs

| Tool | How we used it |
| --- | --- |
| **Gemini API** (`@google/genai`) | `gemini-3.8-flash` (fallback `gemini-3.6-flash`) for intent routing, garment extraction and shopping search; `gemini-nano-banana-2.1` for try-on images and edits; `gemini-embedding-2` for look embeddings. |
| **OpenRouter** | Optional first route for text and image calls, falling back to Google directly. |

### Data and backend

| Tool | How we used it |
| --- | --- |
| **Tiger Data** (Timescale Postgres) | The only database: users, sessions, looks, jobs, plans. `look_events` is a hypertable; `pgvector` with an HNSW index powers the For you ranking. |
| **Next.js 16** (App Router) + **React 19** | Pages and API routes. Background work runs in `after()`. |
| **Tailwind CSS 4** | Styling. |
| **sharp** | Resizes uploads and retailer product photos. |
| **pg** | Database driver, with verified TLS. |
| **Vercel Cron** (`vercel.json`) | Daily trigger for saved plans. |
| **TypeScript**, **ESLint** | Types and lint. |

## How it works

1. The browser sends your text, voice recording and photos to `POST /api/chat`.
2. The server reserves a job (40 requests per user per rolling 24 hours by default) and answers at once.
3. In the background, Gemini reads the request, extracts garments or searches for products, and renders the try-on.
4. The result is saved to Tiger Data. The page polls `/api/jobs` and shows it.

Main files: [lib/gemini.ts](lib/gemini.ts) (model calls), [lib/shop.ts](lib/shop.ts) and [lib/styling.ts](lib/styling.ts) (shopping and budget), [lib/jobs.ts](lib/jobs.ts) (jobs), [db/schema.sql](db/schema.sql) (schema), [app/api/chat/route.ts](app/api/chat/route.ts) (entry point). More detail in [docs/HANDOFF.md](docs/HANDOFF.md).

## Run it locally

Requires Node 24 or newer.

1. Install packages:

   ```bash
   npm install
   ```

2. Create `.env.local` (it is git-ignored; never commit keys):

   ```
   GEMINI_API_KEY=
   DATABASE_URL=
   OPENROUTER_API_KEY=   # optional
   DAILY_JOB_LIMIT=      # optional, default 40
   CRON_SECRET=          # optional, protects /api/cron
   ```

3. Create the tables:

   ```bash
   node --env-file=.env.local scripts/setup-db.ts
   ```

4. Start the app and open http://localhost:3000:

   ```bash
   npm run dev
   ```

## Tests

```bash
npm test
```

Runs offline checks of the model pipeline, routes and product-photo downloads; no paid generations. `npm run test:db` also checks the database and API against a running local server.

## Known limits

- Generated try-ons are best-effort; identity and product details are not exact on every image.
- Prices and stock come from web search, not retailer checkout. Check size and stock with the store.
- No password reset or email verification.
- Demoed from a laptop; not deployed.
