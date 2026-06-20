# DBSC HalSail results → Sail Scoring

Captures and reconstructs **Dublin Bay Sailing Club** summer-series results,
year by year, from the club's published [HalSail](https://halsail.com) pages
into importable `.sailscoring` files — and uses them to populate a DBSC
workspace in [Sail Scoring](https://app.sailscoring.ie).

It is the DBSC counterpart of [`iodai-archive`](https://github.com/sailscoring/iodai-archive):
same shape of work (reconstruct *published* race history into `.sailscoring`),
same payoff.

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

```
sources/              verbatim HalSail captures + the normalized join
  manifest.json         the four datasets (2022–2025)
  <year>/
    catalog.json        normalized class→series join (the deliverable)
    _classdropdown.html raw class list
    series/class-*.html raw per-class series dropdowns (the join, raw)
    results/series-*.html raw results tables, one per (class × series)
scripts/
  halsail-archive-fetch.ts   the capture tool (`pnpm capture`)
```

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

## Capture

```sh
pnpm install
pnpm capture --map-only     # Stage A: datasets + classes + class→series join
pnpm capture                # Stage B: also pull every results table (~983 files)
pnpm capture --year=2025    # restrict to one dataset
```

Single-threaded, 0.75 s between requests, resumable (a file already on disk is
reused, never re-fetched). Read-only against a public archive.

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
