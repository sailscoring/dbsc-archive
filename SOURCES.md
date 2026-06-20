# Sources

All captures come from DBSC's published results on the **Hal archive server**,
`https://archive.halsail.com` — a read-only, public, login-free archive that the
HalSail subscription writes finished seasons to (a club can keep up to 20 yearly
snapshots). It is a *separate application* from the live `halsail.com` site, with
a different URL scheme and renderer.

## Account and datasets

- **Account** (`DSKey` owner): `1426` — Dublin Bay Sailing Club.
- **Datasets** (one archived snapshot per season):

  | DSKey | Dataset |
  |-------|---------|
  | `3413` | DBSC Summer Series 2025 |
  | `3264` | DBSC Summer Series 2024 |
  | `3206` | DBSC Summer Series 2023 |
  | `3123` | DBSC Summer Series 2022 |

## Endpoint family (all public GET, no auth/token)

The archive renders via a four-level AJAX cascade:

| Endpoint | Returns |
|----------|---------|
| `GET /Result/_CrsResultSetDropDown/{account}?DSKey={ds}` | The account's archived datasets (the table above). |
| `GET /Result/_CrsClassDropDown/{ds}` | Classes (fleets) in a dataset; option `value` = dataset-local ClassKey. |
| `GET /Result/_CrsSeryDropDown/{ds}?ClassKey={c}` | **The series available to that class** — the class→series join, exposed nowhere else. Option `value` = SeriesKey. |
| `GET /Result/_CrsResults/{ds}?SeriesKey={s}` | The results table fragment. SeriesKey is unique per `(class × series)` pair. |

Keys are **dataset-local** small integers (a class is `13`, not a global id), so
they only mean anything in the context of their `{ds}`.

## Provenance

Captured by `scripts/halsail-archive-fetch.ts`. Each `sources/<year>/catalog.json`
records the exact `source`, `account`, `dsKey`, and `fetchedAt` for that dataset.
The verbatim `*.html` files are stored unmodified for reproducibility.

The live-site (`halsail.com`) endpoint model, which this archive variant
parallels, is documented at `docs/notes/halsail/querying-public-results.md`.
