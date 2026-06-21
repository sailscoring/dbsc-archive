# DBSC HalSail results → Sail Scoring

Captures and reconstructs **Dublin Bay Sailing Club** summer-series results,
year by year, from the club's published [HalSail](https://halsail.com) pages
into importable `.sailscoring` files — and uses them to populate a DBSC
workspace in [Sail Scoring](https://app.sailscoring.ie).

It is the DBSC counterpart of [`iodai-archive`](https://github.com/sailscoring/iodai-archive):
same shape of work (reconstruct *published* race history into `.sailscoring`),
same payoff.

> 📋 **[CLARIFICATIONS.md](CLARIFICATIONS.md)** — open questions for DBSC about how
> their results were modelled (things we can't resolve from the data alone). Add
> to it whenever a divergence comes down to a DBSC/HalSail decision, not our bug.

## Why

The payoff is the **cross-series identity and ranking** work on the Sail Scoring
horizon (`docs/design/horizon.md` in the app repo — the competitor-identity
spine, the workspace season ladder, and the per-competitor multi-year career-arc
page). Those features only come alive with *years of real history* in one
workspace. DBSC's multi-season summer series — dozens of fleets, the same boats
recurring across days and years — is exactly that fuel, and a far richer,
messier handicap dataset than IODAI's one-design Optimists.

It also keeps a bulky, scraped corpus (~130–150 MB of raw HTML) out of the app
repo, where `reference/data/` is for small illustrative fixtures.

## What's here

Two pipelines share the repo: the **archive** (2022–2025, frozen) and the
**2026 live-parity** loop.

```
sources/
  manifest.json         the four archived datasets (2022–2025)
  <year>/               archive capture (archive.halsail.com)
    catalog.json          normalized class→series join (the deliverable)
    _classdropdown.html   raw class list
    series/class-*.html   raw per-class series dropdowns (the join, raw)
    results/series-*.html raw results tables, one per (class × series)
  2026-live/            live-site (halsail.com) parity dataset
    *.sailscoring         generated day/group series files
    halsail/              captured live result fragments
lib/halsail/           HalSail HTML parser + DBSC day-series builder
scripts/
  halsail-archive-fetch.ts   archive capture (`pnpm capture`)
  halsail-fetch.ts           refresh 2026 live fragments (`pnpm fetch`)
  halsail-to-sailscoring.ts  fragments → .sailscoring (`pnpm to-sailscoring`)
  halsail-compare.ts         parity vs published (`pnpm compare`)
tests/                 vitest for the parser + converter
```

The conversion/parity tooling **reuses the app's scoring engine** by relative
import (`../sailscoring/lib/scoring`), so it needs the sibling `../sailscoring`
checkout. The generic HalSail FAQ and the parity design doc stay in the app repo
(`reference/HalSail FAQ.pdf`, `docs/design/dbsc-parity-plan.md`).

## The HalSail archive model (what we learned)

The archive (`archive.halsail.com`) is a separate app from the live site, with a
four-level AJAX cascade. Crucially, **which tandem series a class is scored under
is only exposed by a per-class AJAX call** (`_CrsSeryDropDown`) and is absent
from any results page — so we persist that class→series join both raw and as
`catalog.json`. See `SOURCES.md` for the endpoint family.

The join settles how DBSC models its season (this is HalSail's **tandem series** —
"ghost" series that re-score the same finishes under a different class, race
subset, or discard rule, mapped in Sail Scoring onto **fleets** × **sub-series**):

- **One "Overall" per class per day** — e.g. `Cruisers 0 IRC` has a single
  Thursday Overall and a single Saturday Overall.
- **Fixed vs progressive split** — fixed-handicap classes (IRC/VPRS) span several
  days; progressive ECHO classes are per-day (their chain restarts each day).
- **Named race-subset tandems** — `Thursday/Saturday Series A & B`,
  `Tuesday Series A/B/C`, the whole-event `Summer Series`.
- **Cross-day pools exist only when explicitly named** — `Thursday & Saturday
  Combined`, `RAYC Super League 1/2`. Never by collapsing a finish-sheet
  boundary; model such a table as its own named sub-series.

## Commands

```sh
pnpm install

# Archive (2022–2025, archive.halsail.com)
pnpm capture --map-only     # Stage A: datasets + classes + class→series join
pnpm capture                # Stage B: also every results table (~983 files)
pnpm capture --year=2025    # restrict to one dataset

# 2026 live parity (halsail.com)
pnpm fetch                  # refresh the live result fragments
pnpm to-sailscoring [day]   # fragments → .sailscoring
pnpm compare [day]          # re-score with the app engine, diff vs published
pnpm test                   # vitest (parser + converter)
```

Captures are single-threaded, 0.75 s between requests, resumable (a file already
on disk is reused, never re-fetched). Read-only against public servers.

## Status

| Year | Catalog (class→series join) | Results tables | Reconstructed `.sailscoring` |
|------|:--:|:--:|:--:|
| 2022 | ✅ | ✅ | ◻️ |
| 2023 | ✅ | ✅ | ◻️ |
| 2024 | ✅ | ✅ | ◻️ |
| 2025 | ✅ | ✅ | ◻️ |

Reconstruction into `.sailscoring` (and parity validation against the published
tables) is future work; the captures above are the evidence base.

## Licensing

This repository contains three kinds of material, licensed separately:

- **Code** — `scripts/`: [MIT](LICENSE).
- **Normalized data & docs** — `sources/**/catalog.json`, `sources/manifest.json`,
  `README.md`, `SOURCES.md`: [CC0 1.0](LICENSE-DATA) (public-domain dedication).
  These are extractions of published facts (series names, keys, structure), and
  facts are not copyrightable.
- **Source pages** — the verbatim `*.html` under `sources/`: **not covered by
  either license.** These are HalSail result pages published by DBSC, included
  only for reproducibility. All rights remain with their owners.
