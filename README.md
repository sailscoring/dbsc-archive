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
the HalSail tandems carried as sub-series (Overall / Series A / B / …).

| 2025 day-group | Overall | Blocks | Notes |
|---|:--:|:--:|---|
| Thursday cruisers | ✅ | ✅ | **fully green** — Q1/Q2 single-competitor flicks + Sigma wind-up reproduced as per-fleet exclusions; Q3 (abandoned 05 Jun, kept in Series A) sourced as a tandem-only race |
| Thursday one-designs | ✅ | ✅ | parity-green |
| Saturday cruisers | ✅ | ⚠️ | Overall + most blocks green; residuals are the **Q5** ±1 ripples through the progressive ECHO/VPRS chains, plus the DNC-only-entrant case (a boat that DNCs every block heat — HalSail ranks it, we drop it). Documented deltas |
| Saturday one-designs | ✅ | ✅* | Q4 per-class A/B boundaries reproduced (Dragon, SB20, IDRA, Melges, PY all green). *One delta: Mixed Sportsboats Series A — a `date#slot` collision (its only Overall heat that day is mis-slotted onto the morning slot) |
| Water Wags | ✅ | ✅ | **fully green** — first three-block group (2025 Summer Series + Series A/B/C) |
| Tuesday one-designs | ✅ | ✅ | **fully green** — Tuesday Overall + Series A/B/C; Women on the Water (its own "2025 Summer Series" combine, a vprs-style coefficient) green too |
| Tuesday cruisers | ✅ | ✅ | **fully green** — Combined Cruisers (ECHO pool) + Combined Group 2 (vprs pool) under "2025 Summer Series"; Cruisers 3 ECHO + IRC under "Tuesday Overall" |

**All four seasons reconstructed.** Each year is a thin
`scripts/halsail-archive-<year>.ts` over the shared `lib/halsail/archive-build.ts`
(`pnpm archive:<year> [group]`). Sub-series are auto-scoped to the fleets that
publish each series name, so a day mixing "Tuesday Overall"/"Series A/B/C" with
the pooled fleets' "Summer Series" models cleanly via #203 fleet-scoping.

| Year | Parity | Structure notes |
|------|:--:|---|
| 2025 | **198 / 17** | VPRS pools (C4-5A/B); Combined Cruisers + Combined Group 2 + WOW |
| 2024 | **203 / 8**  | day-blocks carry the year ("2024 Thursday Series A"); VPRS pools renamed 4A-5A/4B-5B |
| 2023 | **166 / 41** | no VPRS — C5 under IRC + ECHO; Laser (not ILCA); the DNC-listing transition year |
| 2022 | **182 / 22** | C4(+5A) / C5(A+B) IRC+ECHO pools; Water Wags "Wednesday Overall"; Combined Cruisers under "Tuesday Overall" |

(Validation is two-directional — it flags both missing and **extra** boats. Two
families of residual remain: a **multi-race-day discard offset** for one-design
fleets that sail several heats per day (Flying Fifteen, PY Class, ILCA, Laser,
Squib-Mermaid) at high race counts; per-fleet **ECHO/VPRS ±1 ripples**; plus
**roster deltas** where DBSC's per-class config deviated from their own intent —
see below — which are left unreproduced by design.)

**Who appears in a tandem — DBSC's DNC-listing intent.** Each published table's
entrant set is HalSail's curated per-(class, tandem) entry list — whether a boat
that never started is *listed* (all-DNC) or *omitted* — and it is **not derivable
from the finishes** (our builder discards the DNC-vs-absent distinction). The
rosters reveal a clear migration: **2022** listed the full entry list everywhere;
**one-design blocks** began ranking only participants in **2023**; by **2024–25**
every **block** excludes non-starters while the season **Overall** still lists the
entry list. We model that *intent* per sub-series (`excludeDncIntent` →
`SubSeries.excludeDncOnlyCompetitors`), not DBSC's per-class config — so a future
scorer can't reproduce the manual slips, and the residual roster deltas are
exactly those slips. The engine backs this: a sub-series **scores all-DNC
competitors by default** (like a plain series), with `excludeDncOnlyCompetitors`
to rank only participants (HalSail's "exclude boats with only DNC" toggle).

The model that unlocked this is the `sailscoring`#203 sub-series feature: a
sub-series may be **fleet-scoped** and carry **per-fleet race exclusions**, so a
heat that counts for one fleet/tandem but not another is representable. The
builder reproduces HalSail's per-class tandem race membership by striking, per
fleet, the union heats a fleet was scored in but did not include in its own
published tandem — covering Q1/Q2/Q4/Q5 (including DBSC's manual misses, since we
read each fleet's real fragment). Genuinely tandem-only heats — a heat in a
tandem the Overall omits (Q3) — are sourced from the tandem fragments. The output
is format **v11**. Reusable wins along the way: the parser reads **place-only
scratch one-design tables**, and sub-series are assigned by **(date, start-time)**.

> **Resumed (Jun 2026).** The pause is over: `sailscoring`#203 landed the
> fleet-scoped sub-series + per-fleet exclusions, and the single-competitor flicks
> (Q1/Q5) are now reproduced exactly as **per-fleet exclusions** (no engine rule —
> `sailscoring`#232 stays closed). **All four seasons (2022–2025) are now built**
> (749 OK / 88 FAIL, two-directional validation); who-appears-in-a-tandem is
> modelled from DBSC's DNC-listing *intent* (above), leaving their manual
> per-class slips as deltas. The remaining scoring diffs are ECHO/VPRS ±1 ripples
> and the multi-race-day discard offset. **Next:** the multi-race-day discard
> residual, then import into a DBSC workspace.

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
