# Gemi

## The problem

Buying clothes online is guesswork. You cannot see how a piece looks on you, you search many stores to stay inside a budget, and every store asks for your size and style again. Returns cost shoppers and stores time and money.

## The solution

Gemi is an autonomous AI stylist agent. You give it a photo of yourself and a request in text or voice; it does the rest on its own:

- **Tries clothes on you.** From reference photos, a shopping result or a look someone shared. It changes only the pieces you asked for and keeps the rest of your outfit.
- **Searches for clothes.** It searches the web, offers up to three real products per category with photo, price and store link, and keeps the total inside your budget.
- **Plans.** Save a request for a date (for example an outfit for an event) and Gemi runs it that day.
- **Knows your preferences.** It uses your saved sizes, department and style, and learns your taste from the looks you like to rank the community feed and guide shopping.
- **Works in the background.** Every request is a job in the database. Close the tab and come back to the result and the chat history.

Built at **HackUTA 2026** (November 14–15, 2026) during the 24-hour hacking window.

## Tools used

| Tool | How we used it |
| --- | --- |
| **Claude Code** | Main coding agent. Wrote most of the app: the model pipeline, database schema, auth, jobs, screens and tests. |
| **OpenAI Codex** | Second coding agent, for a review-and-fix pass (branch `codex/hackathon-styling-fixes`, merged as PR #1). |
| **Gemini models via OpenRouter** | Most model calls go through OpenRouter: `gemini-3.8-flash` for understanding requests, reading garments and web shopping search, and `gemini-nano-banana-2.1` for try-on images and edits. |
| **Gemini API** (`@google/genai`) | `gemini-embedding-2` for look embeddings, and the fallback when an OpenRouter call fails. |
| **Tiger Data** (Timescale Postgres) | The only database: users, looks, jobs, plans. A hypertable stores look events; `pgvector` powers the For you ranking. |
| **Next.js 16**, **React 19**, **Tailwind CSS 4** | App, API routes and styling. |
| **sharp**, **pg** | Image resizing and the database driver. |
| **Vercel Cron** | Daily trigger for saved plans. |

## Run it locally

Requires Node 24 or newer.

1. Install packages:

   ```bash
   npm install
   ```

2. Create `.env.local` (it is git-ignored; never commit keys):

   ```
   OPENROUTER_API_KEY=
   GEMINI_API_KEY=
   DATABASE_URL=
   ```

3. Create the tables:

   ```bash
   node --env-file=.env.local scripts/setup-db.ts
   ```

4. Start the app and open http://localhost:3000:

   ```bash
   npm run dev
   ```

## License

[MIT](LICENSE)
