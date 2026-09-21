# JEV vs LLM Streamer Chat Moderation Race

A live demo: one chat message is broadcast to TypeSafe's JEV and four frontier LLMs
(via OpenRouter) at once. Watch JEV's pane clear a hateful message almost instantly
while the LLM panes are still visibly reasoning, seconds later, at far higher cost.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in `TYPESAFE_API_KEY` and
   `OPENROUTER_API_KEY`.
3. `npm run dev` and open `http://localhost:3000`.

Set `RACE_MOCK=1` (non-production only) to iterate on the UI without spending real
API credits — canned responses stand in for both JEV and the LLMs.

## Deployment

Requires an always-on Node process with a persistent filesystem for the SQLite file
at `DB_PATH` (default `./data/race.db`) — for example a VPS, Fly.io, Railway, or a
Docker container with a mounted volume. **Do not deploy to Vercel or another
serverless platform** — the filesystem is ephemeral there and the database will not
persist between requests.

## Leaderboard

`/leaderboard` shows aggregate stats (tests run, times flagged, average latency,
average and total cost) per engine, plus two headline lines computed from those real
numbers — never hardcoded.

## Safety

- Input is capped at `MAX_INPUT_LENGTH` characters (default 500).
- Requests are rate-limited per IP (`RATE_LIMIT_PER_MIN`, default 10/minute).
- A rolling 24h spend cap (`MAX_DAILY_SPEND_USD`, default $5.00) disables new
  submissions once crossed, returning a friendly "resting" message.
- Each of the 5 engines fails independently — one erroring or timing out never
  blocks or crashes the other four.
