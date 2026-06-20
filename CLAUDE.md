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
pnpm capture --map-only     # Stage A: datasets + classes + class→series join
pnpm capture                # Stage B: also every results table (~983 files)
pnpm capture --year=2025    # one dataset
```

The capture is plain TypeScript run via `tsx` (node built-ins + `fetch` only — no
other deps, no build step). It is single-threaded with a 0.75 s delay and
**resumable**: a file already on disk is reused, never re-fetched, so re-runs are
cheap and safe.

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

## Relationship to the app repo

Reconstruction and parity validation reuse the app's scoring engine
(`../sailscoring/lib/scoring.ts`) rather than forking it — keep one canonical
engine. The HalSail conversion tooling (`scripts/halsail-{fetch,to-sailscoring,
compare}.ts`, `lib/halsail/`) and the 2026 live-parity dataset still live in the
app repo and are slated to move here; until then, cross-reference them at
`../sailscoring`.

Importing a `.sailscoring` into the production workspace is a manual step a human
performs in the app — this repo's job ends at a validated file.

## Git conventions

- Commit logically (one coherent change per commit). Keep the tree consistent.
- **End every commit message with:**
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- **Do not push unless asked.** Commit locally; let the human review and push.
