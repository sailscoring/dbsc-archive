# Questions for DBSC

Open questions about how DBSC's published HalSail results were modelled that we
**can't resolve from the data alone**. DBSC has offered to help. Each answer lets
us reproduce the affected results exactly and informs the general reconstruction.

Add to this list whenever the reconstruction hits a divergence that comes down to
a HalSail/scoring decision rather than a bug on our side.

## The mechanism behind all of these: per-class tandem series (DBSC, Jun 2026)

In HalSail, DBSC runs a **tandem series per class/fleet**, and each tandem has
**explicit, per-class control over which races it includes**. The results manager
chooses, class by class, exactly which heats land in each (class × tandem) cell.

That single mechanism is behind **every** divergence below:

- **Q1 / Q5** — "flicking" single-competitor heats out of a class's tandem.
- **Q2** — winding up the Sigma 33 one-design at 14 Aug (later heats just not included).
- **Q3** — the abandoned 05 Jun heat included in Cruisers 3 ECHO's Series A but not its Overall.
- **Q4** — one-design classes that share a start placing it in different series.

The per-case *rationale / intent* (deliberate vs oversight) is unclear and not
material; the mechanism is the point. **Implication for Sail Scoring:** a sub-series
here is one **shared** race set scored across all fleets, whereas a HalSail tandem's
race membership is **per-class**. Reproducing these tables exactly therefore needs
**per-fleet (per-class) race membership within a sub-series** — the gap that makes
Q4 unrepresentable today and that the manual single-competitor exclusions (Q1) also
land in.

---

## 1. Single-competitor races — ✅ ANSWERED: manual SI enforcement (2025)

**Answer (Jun 2026).** It is **100% manual enforcement of a DBSC Sailing
Instructions clause** by the results manager — a per-heat human decision, *not* an
automatic rule. Every single-competitor heat is *meant* to be struck. The
"kept" cases below that suggested a "primary class keeps its own start" rule were
a **results-manager miss**: Cruisers 0 ECHO's 26 Jun one-boat heat should have been
excluded too; it simply wasn't. So there is no tandem-vs-primary distinction — just
the SI clause, applied by hand, with the occasional miss.

**What we saw (the evidence that misled us):**

| Fleet | What it is | Its single-boat day(s) |
|---|---|---|
| Cruisers 3 IRC | IRC tandem (the 2 IRC-rated boats of Cruisers 3) | **excluded** (9 of 15 days kept) |
| Cruisers 2 - Sigma 33 | one-design split of Cruisers 2 | **excluded** (12 Jun, 26 Jun, 31 Jul, 28 Aug) |
| Cruisers 5A ECHO | ECHO sub-fleet of the combined 4-5A VPRS pool | **excluded** (05 Jun — only boat 8237 of the 5A boats raced) |
| Cruisers 0 ECHO | the Cruisers 0 class's own series (own start) | **kept** (26 Jun) — ⚠ **this is the error**: should have been excluded |
| Cruisers 3 ECHO | the Cruisers 3 class's own series | **kept** |

We had reverse-engineered a "start-scoped, full-field-keeps" rule to fit the
"kept" row — but it was fitting a mistake. The proposed engine rule
(`sailscoring/sailscoring`#232) is therefore **abandoned** (closed not-planned; the
prototype lives on the local `dbsc-single-competitor-rule-wrong` branch).

**Consequence for reconstruction.** There is no rule to encode. To reproduce these
tables exactly we'd have to replicate the manager's manual exclusions heat-by-heat
(including their misses and inconsistencies) — best modelled as an **explicit
per-heat manual exclusion**, not inferred scoring. Until that exists, the affected
sub-fleets over-score the single-boat days (they count them as DNCs), and Cruisers
0 ECHO's 26 Jun is a published error we won't reproduce.

---

## 2. Sigma 33 one-design — series ends 14 Aug (2025)

Separate from the single-competitor exclusion above (question 1), the **Sigma 33**
one-design table simply **stops at 14 Aug**, even though all three boats keep
racing in Cruisers 2 ECHO through 28 Aug. In particular **21 Aug** is excluded
*despite all three Sigma boats sailing it* (≥2 — so it's not the question-1
exclusion). The one-design split looks like it was wound up mid-August while the
parent class continued.

**Mechanism (Jun 2026).** Per-class tandem race membership (see the overview): the
Sigma 33 tandem simply didn't include the post-14-Aug heats. Whether that wind-up
was deliberate is unclear and not material.

---

## 3. Cruisers 3 ECHO — an abandoned race kept in Series A but dropped from Overall (2025)

On **05 Jun**, the Cruisers 3 race was effectively **abandoned** — all ten boats
are `RET` / `TLE` / `DNC`, **nobody finished**:

> 46 RET · 246 RET · 1038 RET · 2102 RET · 5795 RET · 307 TLE · 11 DNC · 35 DNC · 1792 DNC · 2855 DNC

HalSail's own published Cruisers 3 ECHO tables treat that day **inconsistently**:
- **Overall** doesn't include 05 Jun at all (it runs 29 May → 12 Jun).
- **Series A** *does* include 05 Jun, scoring those boats their RET/TLE points.

So Series A contains a race the Overall excludes, for the same fleet. We drop a
heat that nobody finished, which matches the **Overall** (parity-green) but not
**Series A** (the RET/TLE boats diverge). The two published tables can't both be
matched.

**Mechanism (Jun 2026).** Per-class tandem race membership (see the overview): the
05 Jun heat was included in the Series A tandem but not the Overall tandem. Slip or
intent is unclear and not material; the two tandems just carry different race sets.

---

## 4. One-design classes split the same calendar into Series A/B differently (2025)

On the one-design days (Saturday, Tuesday), each class keeps its **own** Series A
/ Series B boundary, because the sparse classes (ILCA, IDRA, Melges, …) sail only
a handful of races. The split can fall on the **same physical start**: on the **07 Jun 2025** 14:03
start, Fireball scores it **Series A** while IDRA 14 and Melges 15 (who started
alongside it) score it **Series B**.

In Sail Scoring we model a day as one series with the tandems as **sub-series**,
where a sub-series is a single shared set of races scored across every fleet. That
cannot represent two classes assigning the *same* start to different series. The
day's **Overall** reproduces exactly (each fleet scores only the races it sailed);
the per-class **Series A/B cells** diverge for the classes whose boundary differs
from their start-mates'.

Three classes (Dragon, SB20, Sportsboats) additionally have **one race that is in
their Series A/B but not their Overall** — the same Overall-vs-tandem inconsistency
as question 3; our Overall-sourced build can't see those races at all.

**Mechanism (Jun 2026).** Confirmed: the one-design Series A/B *are* independent
per-class race subsets (per-class tandem race membership — see the overview), so
two classes on one start genuinely land it in different series. There is no single
intended A/B calendar boundary.

**Impact / status.** Accepted as a modelling divergence (it is not a scoring bug):
the combined day-file reproduces every Overall and most A/B cells, but cannot
reproduce A/B for classes whose boundary disagrees with their start-mates' — because
our sub-series share one race set across fleets, while HalSail's tandems are
per-class. Closing this gap needs per-fleet race membership in a sub-series (see
the overview's implication). See the Saturday/Tuesday one-design groups.

---

## 5. Single-competitor heats — Thursday excludes, Saturday keeps — ✅ ANSWERED (2025)

**Answer (Jun 2026).** Same resolution as question 1: the exclusion is **manual SI
enforcement**, so the Thursday-vs-Saturday difference for the *same* fleet is just
human inconsistency, not a rule. There is nothing to reverse-engineer.

The evidence, for the record — Cruisers 3 IRC (boats 998, 5795):

- **Thursday**: 15 days sailed, **9 kept** — its single-boat days were struck, and
  all 9 kept heats have both boats finishing.
- **Saturday**: **5 kept**, including two single-finisher heats that were **not**
  struck: 21 Jun (`998` 1st, `5795` DNF) and 20 Sep (`998` 1st, `5795` DNC, scored
  `2/DNC`).

The same fleet's single-boat heats were struck on Thursday but left on Saturday —
a manual application that varied by day. This confirmed question 1's answer (a
hand-applied SI clause with misses) rather than posing a separate puzzle.

**Impact / status.** No engine rule (`sailscoring`#232 closed not-planned). The
Saturday cruiser residuals — Cruisers 3 IRC, Sigma 33, and the small (±1) net
offsets that ripple through the progressive **ECHO** chains (Cruisers 1/5A/5B ECHO)
when a mid-chain heat is or isn't struck — all trace here, and would only resolve
by replicating the manager's manual exclusions heat-by-heat (see question 1).
