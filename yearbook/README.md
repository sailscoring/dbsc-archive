# DBSC Yearbook transcriptions

Trophy-winner tables transcribed from the annual **DBSC Yearbook** (published
with Afloat magazine, hosted on Issuu). Each year's class pages carry a
"Trophy Winners" table naming the previous season's prize winners — data that
exists nowhere in the HalSail results archive.

There is no immediate consumer; the intent is to feed a future Sail Scoring
feature for archiving past-year prize winners.

## Provenance and method

- The yearbook is published on Issuu, which offers no download; pages were
  transcribed manually from screenshots of the Issuu viewer. The screenshots
  themselves are **not** committed — each `<year>/trophy-winners.md` records
  the source URL and page numbers instead.
- Transcription is **verbatim**, including the yearbook's own typos and
  inconsistent spellings, marked `(sic)` or footnoted where they could mislead.
- The usual rule applies: only real published data. If a class page prints no
  trophy-winner table, that class is listed as "none published" — nothing is
  filled in from other sources.

## Layout

```
yearbook/
  <edition-year>/
    trophy-winners.md   winners of the *previous* season's trophies,
                        as published in that edition
```

Note the year offset: the 2026 yearbook publishes "Trophy Winners 2025".
