# CLAUDE.md

Guidance for Claude Code working in this repo. **Read `README.md` first** — it has
the mission, the layout, the HalSail archive model, and the status tracker. This
file covers the working conventions.

## What this repo is

A data pipeline, not an application. It captures DBSC's published
[HalSail](https://halsail.com) summer-series results — verbatim from the public
archive at `archive.halsail.com` — and (as future work) reconstructs them into
importable `.sailscoring` files to populate a DBSC workspace in Sail Scoring. The
end goal is to feed the **cross-series identity & ranking** features (see the app
repo's `docs/design/horizon.md`) with real multi-year DBSC history.

It is the DBSC counterpart of the sibling `iodai-archive` repo; the same spirit
applies. Domain background (handicap systems, fleets, tandem series) lives in the
app repo under `../sailscoring/docs/` and `../sailscoring/reference/`.

## Commands

```
pnpm install
pnpm capture --map-only     # archive (archive.halsail.com): Stage A map
pnpm capture                # archive: Stage B, every results table (~983 files)
pnpm capture --year=2025    # one dataset

pnpm fetch                  # 2026 live (halsail.com): refresh result fragments
pnpm to-sailscoring [day]   # 2026 live: fragments → .sailscoring
pnpm compare [day]          # 2026 live: parity check vs published standings
pnpm test                   # vitest (parser + converter)
```

Two pipelines share this repo: the **archive** capture (2022–2025, frozen, under
`sources/<year>/`) and the **2026 live-parity** loop (`sources/2026-live/`). All
are TypeScript run via `tsx`/`vitest` — node built-ins + `fetch`, no build step.
The capture is single-threaded with a 0.75 s delay and **resumable** (a file on
disk is reused, never re-fetched), so re-runs are cheap.

## Rules that are easy to get wrong

1. **Be a good citizen to the archive.** Keep the single-threaded ~0.75 s delay.
   It is a small public server; never parallelise or hammer it. Captures are
   frozen — re-fetch only when you have reason to believe the archive changed.

2. **Source pages are verbatim and third-party.** The `*.html` under `sources/`
   are unmodified HalSail output, kept for reproducibility; do not edit them, and
   do not relicense them (see README "Licensing"). Our own artifacts are the
   `catalog.json` / `manifest.json` (normalized) — those are CC0.

3. **Keys are dataset-local.** A ClassKey/SeriesKey (e.g. `13`) only means
   anything within its `{ds}`. Never treat them as global ids across years.

4. **Only real published data.** If a result is missing from the archive, leave
   it missing — do not fabricate, interpolate, or guess. Partial coverage is fine.

5. **When a parity divergence is a DBSC/HalSail modelling decision (not our bug),
   record it in [`CLARIFICATIONS.md`](CLARIFICATIONS.md)** rather than coding a
   speculative rule. Don't guess at intent (e.g. "the scorer must have removed
   those races") — state what's verified and ask DBSC.

## Relationship to the app repo

The capture, conversion, and parity tooling all live here now
(`scripts/halsail-*.ts`, `lib/halsail/`, `tests/`). They **reuse** the app's
scoring engine and types by relative import (`../sailscoring/lib/scoring`,
`../sailscoring/lib/types`) rather than forking them — one canonical engine. This
assumes the sibling app checkout exists at `../sailscoring` (the same assumption
iodai-archive makes). The engine island is dependency-free, so `tsx`/`vitest`
resolve it with no app `node_modules`.

Two HalSail things deliberately **stay in the app** as the generic, club-agnostic
layer: `reference/HalSail FAQ.pdf` (the product FAQ) and
`docs/design/dbsc-parity-plan.md` (the parity design doc). The generic *parser*
(`lib/halsail/parse-results.ts`) moved here with the rest of the pipeline; if a
second HalSail club is ever onboarded, consider hoisting it back to a shared home.

Importing a `.sailscoring` into the production workspace is a manual step a human
performs in the app — this repo's job ends at a validated file.

## Git conventions

- Commit logically (one coherent change per commit). Keep the tree consistent.
- **End every commit message with:**
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- **Do not push unless asked.** Commit locally; let the human review and push.
