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

# Archive reconstruction → .sailscoring (validates vs published)
pnpm archive:2025           # build + validate every 2025 day-group
pnpm archive:2025 [group]   # one group (e.g. thursday-cruisers, saturday-od)

# 2026 live parity (halsail.com)
pnpm fetch                  # refresh the live result fragments
pnpm to-sailscoring [day]   # fragments → .sailscoring
pnpm compare [day]          # re-score with the app engine, diff vs published
pnpm test                   # vitest (parser + converter)
```

Captures are single-threaded, 0.75 s between requests, resumable (a file already
on disk is reused, never re-fetched). Read-only against public servers.

## Status

**Capture** — every year fully captured (catalog + results tables); the evidence base.

| Year | Catalog (class→series join) | Results tables |
|------|:--:|:--:|
| 2022 | ✅ | ✅ |
| 2023 | ✅ | ✅ |
| 2024 | ✅ | ✅ |
| 2025 | ✅ | ✅ |

**Reconstruction** — `archive.halsail.com` → `.sailscoring`, validating each
(sub-series × fleet) Net against the published table (`pnpm archive:2025 [group]`,
builders in `scripts/halsail-archive-2025.ts`). Started with **2025** (it has the
fullest Series A/B structure). One `.sailscoring` per finish-sheet day-group, with
the HalSail tandems carried as sub-series (Overall / Series A / B).

| 2025 day-group | Overall | Series A/B | Notes |
|---|:--:|:--:|---|
| Thursday cruisers | ✅ | ✅ | residual 2 = Q2 (Sigma ends 14 Aug) + Q3 (abandoned 05 Jun) |
| Thursday one-designs | ✅ | ✅ | parity-green |
| Saturday cruisers | ✅ | ⚠️ | A/B residuals = **Q5** (single-competitor heats / `sailscoring`#232) |
| Saturday one-designs | ✅ | ⚠️ | A/B residuals = **Q4** (per-class A/B boundaries) |
| Tuesday (cruisers + OD) | — | — | not started — needs N-block (Series A/B/**C**) sub-series; introduces Combined Cruisers / Combined Group 2 / Women on the Water (Phase-B concepts) |
| Water Wags | — | — | not started — `2025 Series A/B/C`, also N-block |
| 2024 / 2023 / 2022 | — | — | not started |

Every **Overall** reproduces exactly. The remaining A/B divergences are *DBSC/HalSail
modelling decisions, not scoring bugs* — see [`CLARIFICATIONS.md`](CLARIFICATIONS.md)
Q1–Q5. Two reusable wins landed along the way: the parser now reads **place-only
scratch one-design tables**, and sub-series are assigned by **(date, start-time)**
so multi-race days split correctly.

> **Paused (Jun 2026)** pending a deeper look at how HalSail itself decides these
> cases — chiefly **Q5**: the same fleet (Cruisers 3 IRC) *excludes* single-competitor
> heats on Thursday but *keeps* them on Saturday, which contradicts the blanket
> start-scoped exclusion in `sailscoring`#232. The Saturday cruiser parity is a moving
> target until that rule is settled, so Tuesday's cruiser/Combined groups are held.

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
