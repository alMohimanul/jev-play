# Agent Tool-Routing ReAct Loop — Design Spec

## Context and motivation

The `/agent-race` scenario currently asks every engine (JEV + 7 LLMs) to solve a
compound, multi-intent request in **one shot**: "list every tool that applies."

Real-world investigation (this session, live JEV API) showed why this
disadvantages JEV specifically: JEV's `choice` question is a single softmax
distribution over all tools, normalized to sum to ~1. On a genuinely
3-intent message ("find flights to Paris, book a hotel, reschedule my
dentist appointment"), JEV correctly assigned nonzero probability to all
three tools (`book_flight` 68%, `reschedule_meeting` 7%, `book_hotel` 5%,
plus some noise), but only `book_flight` cleared the 15% multi-select
threshold. The other two are genuinely "seen" by JEV but starved by having
to share one fixed probability budget — not a bug, an architectural
mismatch between the demo's one-shot-multi-select harness and how JEV's
`choice` primitive actually works.

Real agent frameworks don't ask a router to pick every tool for a compound
request up front. They run an iterative loop (ReAct / plan-execute): pick
the single best next tool, "execute" it, decide what's left, repeat. That
is exactly what JEV's single-choice primitive is built for. This spec
changes `/agent-race`'s harness to that iterative loop, applied identically
to JEV and every LLM, so the comparison is architecturally fair — and so
excluding an already-picked tool from the next round's candidate set lets
the remaining probability mass renormalize onto the tools that are
actually still needed.

**Scope:** `/agent-race` only. The moderation scenario (`/`) and its SQLite
schema/leaderboard are untouched.

## Global constraints

- Max 3 rounds per engine per submission (hard safety cap on cost/latency).
- Round-continue floor: 15% (reused from today's `MULTI_SELECT_THRESHOLD`,
  renamed `CONTINUE_THRESHOLD`).
- Round 1 keeps today's graceful fallback: if `done` does not outright win
  the round, the top real tool is accepted even if below the floor (matches
  today's "always return at least the top choice" behavior). Rounds 2 and 3
  require the top real tool to clear the floor to be accepted; otherwise the
  loop stops without adding a tool for that round.
- Every engine (JEV and all 7 LLMs) runs the identical loop protocol — same
  stopping rule, same round cap, same "exclude prior picks" mechanic. This
  parity is the entire point: judging JEV against LLMs only makes sense if
  neither side gets a structurally different task.
- DB schema and leaderboard/correctness scoring are unchanged. The DB still
  receives one aggregated row per engine per submission, in the same shape
  as today (`tools`, `confidence`, summed `latencyMs`/`inputTokens`/
  `outputTokens`/`costUsd`). Round-level detail is a live-UI-only concept,
  not persisted.
- Per-submission rate limiting and daily spend cap checks stay exactly as
  they are today (checked once before the broadcast starts). No new
  mid-loop spend checks — loops are capped at 3 rounds, this is a demo, not
  worth the added complexity.

## Known, pre-existing asymmetry (unchanged by this redesign)

JEV's per-round confidence is a real value from an actual probability
distribution; an LLM's per-round confidence is self-reported as part of its
own JSON answer. This asymmetry already existed in the one-shot design and
is not something this redesign resolves — it's a structural difference
between the two kinds of engine that the demo should keep being honest
about (e.g. still show JEV's full per-round distribution where useful,
LLMs' single self-reported number).

## The `done` sentinel

Every round's candidate set is "all tools not yet picked in this loop,
plus one sentinel option": `done`, described as:

> "Choose this when no further distinct tool is needed to address any
> remaining part of the request beyond what has already been decided in
> prior rounds."

For JEV, `done` is scored by the same `choice` call, alongside the real
tools, sharing the same probability budget. For LLMs, `done` is one more
literal id they can name in their single-tool JSON answer.

## Shared constants and loop runner — `src/lib/route-loop.ts` (new)

```ts
export const DONE_TOOL = 'done'
export const CONTINUE_THRESHOLD = 0.15
export const MAX_ROUNDS = 3
export const DONE_DESCRIPTION =
  'Choose this when no further distinct tool is needed to address any remaining part of the request beyond what has already been decided in prior rounds.'
```

`runRouteLoop` is a single generic implementation shared by JEV and every
LLM — it doesn't know or care which kind of engine it's driving, only how
to call one round and how to interpret the result:

```ts
export interface RoundResult {
  tool: string              // a real tool id, or DONE_TOOL
  intent: string | null
  confidence: number | null
  toolProbabilities: Record<string, number> | null  // JEV only; null for LLMs
  latencyMs: number
  costUsd: number
  inputTokens: number | null
  outputTokens: number | null
}

export type RoundOutcome =
  | { ok: true; round: RoundResult }
  | { ok: false; error: string }

export async function runRouteLoop(
  callRound: (excludeTools: string[], roundIndex: number) => Promise<RoundOutcome>,
  onRound: (round: RoundResult, roundIndex: number) => void
): Promise<{ ok: true; rounds: RoundResult[] } | { ok: false; error: string }>
```

Behavior:
1. `roundIndex` starts at 0. `excludeTools` starts empty.
2. Call `callRound(excludeTools, roundIndex)`.
3. If `!ok`, stop immediately and return `{ ok: false, error }` — a failed
   round is a terminal error for the whole engine, same UX as today's
   single-call failures.
4. If `round.tool === DONE_TOOL`, stop (without adding a tool) and return
   `{ ok: true, rounds }` (rounds collected so far, possibly empty).
5. Otherwise, determine whether to accept this round's tool:
   - `roundIndex === 0`: accept unconditionally (graceful fallback).
   - `roundIndex > 0`: accept only if `round.confidence >= CONTINUE_THRESHOLD`
     (or, for JEV, if the winning tool's own probability is
     >= `CONTINUE_THRESHOLD` — same check, the number just comes from a real
     distribution instead of self-report).
   - If not accepted, stop without adding this round's tool.
6. If accepted: call `onRound(round, roundIndex)` (fires the live SSE
   `round` event), push `round.tool` onto `excludeTools`, increment
   `roundIndex`, and continue unless `roundIndex === MAX_ROUNDS`.
7. If `roundIndex === MAX_ROUNDS` is reached with an accepted tool, stop
   (the cap, not `done`, ended the loop).

## JEV: round primitive — `src/lib/route-jev.ts`

Replace `callJevRoute(text)` with:

```ts
export async function callJevRound(text: string, excludeTools: string[]): Promise<RoundOutcome>
```

- `criteria` = `TOOL_OPTIONS` filtered to drop any id in `excludeTools`,
  plus `{ done: DONE_DESCRIPTION }` always appended.
- Same JEV endpoint/request shape as today. Parse `probabilities`, find the
  entry for `done` and the top real (non-`done`) entry.
- If `done`'s probability is the single highest in the distribution, return
  `{ tool: DONE_TOOL, intent: null, confidence: probabilities.done, toolProbabilities: probabilities, ... }`.
- Otherwise return the top real tool as `tool`, with `intent` computed via
  the existing `dominantIntent()` aggregation (unchanged from the
  intent-first work — still a free aggregation over the same distribution,
  now scoped to whichever tools remain candidates this round).
- Drop `selectTools()` / `MULTI_SELECT_THRESHOLD` entirely — multiplicity is
  now handled by the loop, not by a within-call threshold.
- Cost/latency reflect this one call only (the loop runner sums across
  rounds for the final aggregate).

## LLMs: round primitive — `src/lib/route-openrouter.ts`

Replace `streamOpenRouterRoute(text, model, onDelta)` with:

```ts
export async function streamOpenRouterRound(
  text: string,
  model: string,
  excludeTools: string[],
  roundIndex: number,
  onDelta: (chunk: string) => void,
  timeoutMs?: number
): Promise<RoundOutcome>
```

System prompt changes from "select every tool that applies" to a
round-aware, single-tool contract:

- States this is round `roundIndex + 1` of at most `MAX_ROUNDS`.
- If `excludeTools` is non-empty: "In prior rounds you already decided
  these tools are needed: `[...excludeTools]`. Do not repeat them."
- Tool list = `TOOL_OPTIONS` minus `excludeTools`, plus `done` with
  `DONE_DESCRIPTION`, each still tagged with its intent bucket as today.
- Same 3-bucket intent-first instruction as today, but intent is only
  meaningful when `tool !== 'done'`.
- New JSON contract (singular `tool`, not a `tools` array):
  `ANSWER: {"intent": "<lookup|action|escalate>" | null, "tool": "<id or 'done'>", "confidence": 0.0-1.0}`
- `reasoning` config unchanged (still `getReasoningConfig(model)` from the
  prior fix).

## Verdict parsing — `src/lib/route-verdict-parser.ts`

Replace the array-based `parseRouteVerdictText` with a single-tool version:

```ts
export interface ParsedRouteRound {
  tool: string | null   // a known tool id, or 'done', or null if unparseable
  intent: string | null
  confidence: number | null
  error: string | null
}

export function parseRouteRoundText(fullText: string): ParsedRouteRound
```

- Valid `tool` values: any `isKnownTool(id)` id, or the literal `DONE_TOOL`.
  Anything else is dropped (falls back to the unparseable-error shape, same
  pattern as today's unknown-tool filtering).
- `intent` parses and validates exactly as today (`isKnownIntent`), except
  it's expected to be `null` when `tool === 'done'`.

## Wire protocol — `src/types.ts`, `src/lib/sse.ts` usage

New event type `round`, payload:

```ts
export interface RouteRoundPayload {
  engine: EngineId
  roundIndex: number   // 0-based; UI displays roundIndex + 1
  tool: string         // a real tool id, or 'done'
  intent: string | null
  confidence: number | null
  toolProbabilities: Record<string, number> | null
  latencyMs: number     // this round only
  costUsd: number       // this round only
  inputTokens: number | null
  outputTokens: number | null
}
```

`RouteVerdictPayload` (the existing final-verdict event) changes shape —
drops the top-level `toolProbabilities` and `intent` fields (superseded by
the `rounds[]` breakdown, one intent/distribution per round now) and gains
`rounds`:

```ts
export interface RouteVerdictPayload {
  engine: EngineId
  tools: string[]              // all non-'done' tools picked, across rounds, in pick order
  rounds: RouteRoundPayload[]  // full breakdown, for the UI trace
  confidence: number | null    // confidence of the last round that picked a real tool; null if zero tools
  latencyMs: number            // sum across all rounds run
  costUsd: number               // sum across all rounds run
  inputTokens: number | null    // sum
  outputTokens: number | null   // sum
}
```

`DeltaPayload` gains `roundIndex: number` so the client knows which round's
live reasoning text a chunk belongs to (otherwise round 2's streaming text
would append onto round 1's already-finalized trace row).

`RouteVerdictRow` (the DB row shape) is **unchanged** — still just `tools`,
`confidence`, `latencyMs`, `inputTokens`, `outputTokens`, `costUsd`, `error`,
now populated from the loop's aggregated totals instead of a single call.

## Server orchestration — `src/app/api/agent-broadcast/route.ts`

For each engine, build a `callRound` closure over its round primitive
(`callJevRound` or `streamOpenRouterRound`, mock equivalents in `RACE_MOCK`
mode) and drive it through `runRouteLoop`. The closure is what adapts each
primitive's own signature to `runRouteLoop`'s `(excludeTools, roundIndex) =>
Promise<RoundOutcome>` shape — for JEV, `(excludeTools, roundIndex) =>
callJevRound(text, excludeTools)` (JEV's primitive doesn't need
`roundIndex`, so the closure just ignores it); for each LLM,
`(excludeTools, roundIndex) => streamOpenRouterRound(text, model,
excludeTools, roundIndex, onDelta)` (the LLM's prompt does need
`roundIndex`, to say "round X of 3").

Once the closure exists:

- `onRound` callback: send SSE `round` event immediately (`{ engine, roundIndex, ...round }`).
- On loop completion (`ok: true`): build the aggregated `RouteVerdictPayload`
  (`tools` = accepted rounds' tool ids in order, `rounds` = full list,
  `confidence` = last accepted round's confidence, sums for
  latency/cost/tokens), send `verdict`, write to DB via the existing
  `insertRouteVerdict` call (unchanged shape).
- On loop failure (`ok: false`): send `error` and write the existing
  zeroed error row to DB, exactly as today.
- Existing rate-limit / daily-spend-cap / submission-insert logic is
  unchanged, checked once before any engine starts looping.

## Mock engines — `src/lib/mock-route.ts`

Rebuilt on top of the same `runRouteLoop`, so `RACE_MOCK=1` dev testing
exercises the identical loop/stop logic as production. The existing
`classify(text)` heuristic already infers a small ordered list of tools
for a handful of test phrases (e.g. order-status+cancel); wrap it in a
fake single-round primitive that pops the next tool off that list each
call (or returns `done` once exhausted), and feed that into `runRouteLoop`
exactly like the real primitives.

## UI — `src/components/RouteEngineCard.tsx`, `RouteGrid.tsx`

Props change: drop `tools` / `toolProbabilities` / `intent` / `confidence`
as individually-passed props, replace with `rounds: RouteRoundPayload[]`
(rounds resolved so far — grows live as `round` events arrive) plus a
`currentRoundIndex` / `reasoningText` pair for whichever round is currently
in-flight (LLMs only; JEV rounds resolve too fast to meaningfully show
streaming text).

Card body renders one trace row per resolved round:

```
Round 1 → [Intent: Action] Book Flight 68% · 0.05s
Round 2 → [Intent: Action] Book Hotel 74% · 0.06s
Round 3 → done
```

- A round that resolved to `done` renders as a plain "done" row, no intent
  badge, no tool chip.
- While a round is in flight, show the existing pending/reasoning-text
  treatment in place of that round's row; once it resolves, replace it with
  the finalized row above. Only the in-progress round's reasoning text is
  ever shown — a resolved round's reasoning text is discarded, not
  retained, to keep the card from growing into a full 3-round transcript.
- "Inconclusive" (today's zero-tools fallback UI) now means: round 1
  resolved straight to `done` (i.e. `rounds.length === 0`).
- Footer stats become: total elapsed time (sum, as today) and total cost
  (sum, as today). The old standalone "Overall X%" confidence chip is
  removed — confidence is now shown inline per round via each row's tool
  chip, matching how JEV's per-tool percentages already worked.
- Placement badge behavior is unchanged: assigned in the order each
  engine's final `verdict` (i.e. full loop completion) arrives.

`useRouteBroadcast.ts` gains handling for the `round` SSE event
(append to that engine's `rounds` array, keyed by `roundIndex`) alongside
the existing `init` / `delta` (now round-scoped) / `verdict` / `error` /
`done` handling.

## Testing approach (for the implementation plan to detail)

- `route-loop.ts`: unit-tested in isolation with a fake `callRound` that
  returns a scripted sequence of rounds — covers accept/reject-by-floor,
  round-1 graceful fallback, `done`-wins-immediately, and the
  `MAX_ROUNDS` cap, all without touching a real API.
- `route-jev.ts` / `route-openrouter.ts`: each round primitive is tested
  the same way single-shot calls are tested today (mocked `fetch`), just
  asserting the new single-tool-or-`done` response shape and that
  `excludeTools` is actually removed from the candidate set / prompt.
- `route-verdict-parser.ts`: same style as today, single-tool contract.
- `agent-broadcast/route.ts`: existing SSE-shape tests extended to assert
  `round` events appear before the final `verdict`, and that the
  aggregated `verdict` sums match the individual rounds.
- `RouteEngineCard.test.tsx`: rewritten around the `rounds` prop — asserts
  the trace renders in order, `done` rows render distinctly, and
  "Inconclusive" shows only when `rounds` is empty.
- A live, non-mocked check (same pattern used throughout this session)
  should re-run the exact "find flights, book hotel, reschedule
  appointment" message once implemented, to confirm JEV's round 2/3
  probabilities actually do renormalize above the floor as hypothesized —
  this is the whole point of the redesign and should be verified with real
  data, not assumed.
