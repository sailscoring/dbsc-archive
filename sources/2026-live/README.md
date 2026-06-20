# 2026 DBSC Summer Series — reference data

Reference material and tooling for the DBSC parity work (see the app repo's
`docs/design/dbsc-parity-plan.md`). The goal is to reproduce DBSC's published
HalSail results exactly, starting with the **Thursday Blue** cruiser group.

## Contents

- **`halsail/`** — frozen HalSail public-results fragments
  (`GET /Result/_Boat/{seriesId}`), captured once so we don't re-probe the
  live site. Naming: `{fleet}-{seriesId}.html`. See
  `../../docs/notes/halsail/querying-public-results.md` for the endpoint structure.
  `_catalog-public-95476.html` is a `/Result/Public` shell carrying the full
  club fleet/series catalogue.
- **`dbsc-thursday-blue-2026.sailscoring`** — generated input file (format v6),
  for import into the DBSC workspace. Built by `pnpm to-sailscoring`
  from the fragments via `lib/halsail/parse-results.ts` +
  `lib/halsail/to-series.ts`. Carries **input only** (competitors, ratings,
  races, finishes, codes); the app recomputes all standings.

## Weekly workflow

The loop after DBSC scores a new Thursday race. The nine HalSail series ids
are stable all season — "Thursday Overall" keeps its `seriesId` and just gains
races — so step 1 re-pulls the *same* ids over the *same* filenames.

1. **Re-fetch the fragments.** `pnpm fetch` pulls all nine fleet
   fragments by id into `halsail/`. (Equivalent to nine
   `curl -L https://halsail.com/Result/_Boat/{seriesId}` calls; see the id
   table in the parity plan.)
2. **Regenerate.** `pnpm to-sailscoring`. Races are derived from the
   fragments, so new races flow through automatically, and the snapshot
   lineage is threaded (see below).
3. **Update the series.** In the imported series, **Settings → Update from
   file** → pick the regenerated `.sailscoring`. It imports as a clean update
   (see lineage below).
4. **Compare** against HalSail with `pnpm compare` (offline — runs the
   engine on the `.sailscoring` and diffs the published HalSail summary
   tables). Optionally **publish** each fleet's page afterwards.

### Identity and lineage (why the update is clean)

The app matches a file to an existing series by **`seriesId`**, and treats it
as a clean descendant when the file's **`snapshotHistory`** includes the local
series' `lastSnapshotId`. So the generator **carries both forward** from the
previously generated file: it keeps the prior `seriesId` and appends a fresh
content-hash `snapshotId` (a valid RFC 4122 UUID — the app validates with
`z.uuid()`) to the prior history. A weekly regeneration is therefore a clean
descendant of the imported series, and **Settings → Update from file** accepts
it. Don't `git rm` the committed `.sailscoring` between runs — the identity and
chain are read from it.

**Bootstrapping the UUID (one-time).** A freshly generated file carries a slug
`seriesId`, so the *first* import opens a new series and the app assigns it a
real UUID. To make subsequent regenerations update that same series, seed the
committed file with the in-app identity once: export the series from the app
(its `.sailscoring` carries the UUID + current lineage) and run

```sh
pnpm to-sailscoring --adopt /path/to/exported.sailscoring
```

`--adopt` takes the `seriesId` and `snapshotHistory` from that export; every
later `pnpm to-sailscoring` (no flag) inherits them from the committed
file. This series has already been seeded.

## Scope (Milestone 1)

One Sail Scoring series modelling the Thursday Blue finish sheet: Cruisers
0/1/2/3 under ECHO, Cruisers 0/1/2 under IRC, plus the J/109 and Sigma 33
one-design fleets that ride the same sheet. Each boat sits in every fleet
that applies to it (multi-fleet membership), so one imported finish entry
scores it everywhere.

## Parity status

The generated file reproduces the Thursday Blue IRC + ECHO standings exactly —
net points, per-race places, codes, discards, and finishing order — checked by
`pnpm compare`, which is green on all nine fleets. Getting here closed
five gaps in the engine and one in the converter (all landed; see the parity
plan for the per-feature detail):

1. **Modified A5.3 for DNC** — new `startingAreaInclDnc` `dnfScoring` mode:
   DNC also scores as (boats that came to the starting area) + 1, per race.
   DBSC SI A13.2.
2. **Redress in handicap fleets** — redress (RDG) previously applied only in
   scratch fleets; the engine now resolves the per-fleet average in IRC/ECHO
   fleets too.
3. **RDG types from HalSail** — the parser reads the RDG type from the Place
   cell; RDG type 2 maps to the new `all_races_excl_dnc` redress method (drop
   DNC up to the discard allowance), with types 1/3 mapped to existing methods.
4. **Per-race rating overrides** — a mid-series fixed-rating change is now
   modelled exactly: a boat carries its current rating, and earlier races pin
   the old value via a per-race override. Boat **2160 (Chimaera)**, which
   re-rated from IRC TCC **1.008** (races 1–3) to **1.001** (races 5–6) — the
   `*` in HalSail's Hcap column — is reproduced with the right corrected time
   in every race, not just the right placing.
5. **RRS A8.1 series tie-break** — `halsail:compare` flagged it once the other
   four matched: the tie-break skipped A8.1 (sorted race scores excluding
   discards) and mis-ordered boats on equal net points. Now correct (#173).

These also tightened the converter: the snapshot lineage ids it mints are now
valid RFC 4122 UUIDs so the file imports cleanly through the app's `z.uuid()`
API boundary (Postgres' `uuid` column was lenient and masked this).
