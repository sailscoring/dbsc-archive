# DBSC Yearbook transcriptions

Trophy-winner tables transcribed from the annual **DBSC Yearbook** (published
with Afloat magazine, hosted on Issuu). Each year's class pages carry a
"Trophy Winners" table naming the previous season's prize winners — data that
exists nowhere in the HalSail results archive.

There is no immediate consumer; the intent is to feed a future Sail Scoring
feature for archiving past-year prize winners.

## Provenance and method

- Some editions are published only on Issuu, which offers no download; those
  pages were transcribed manually from screenshots of the Issuu viewer (the
  screenshots themselves are **not** committed). Other editions are hosted as
  PDFs on dbsc.ie and were transcribed from the PDF text layer, with page
  renders used to resolve pages whose artwork hides stale text layers (the
  Cruiser 0 pages in the 2022–2024 PDFs carry older tables as hidden text).
  Each `<year>/trophy-winners.md` records its source URL, page numbers, and
  method.
- Transcription is **verbatim**, including the yearbook's own typos and
  inconsistent spellings, marked `(sic)` or footnoted where they could mislead.
- The usual rule applies: only real published data. If a class page prints no
  trophy-winner table, that class is listed as "none published" — nothing is
  filled in from other sources.
- Some class tables carry a printed year that differs from the edition's
  expected previous season (stale headings), and some tables are repeated
  verbatim across editions (likely reprints). Both are recorded as printed,
  with a note per table — we don't resolve which season the data actually
  belongs to.

## Layout

```
yearbook/
  <edition-year>/
    trophy-winners.md   winners of the *previous* season's trophies,
                        as published in that edition
```

Note the year offset: the 2026 yearbook publishes "Trophy Winners 2025".
