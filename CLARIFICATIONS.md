# Questions for DBSC

Open questions about how DBSC's published HalSail results were modelled that we
**can't resolve from the data alone**. DBSC has offered to help. Each answer lets
us reproduce the affected results exactly and informs the general reconstruction.

Add to this list whenever the reconstruction hits a divergence that comes down to
a HalSail/scoring decision rather than a bug on our side.

---

## 1. Single-competitor races — excluded for Cruisers 3 IRC, kept for ECHO (2025)

**What we see — now confirmed on two independent fleets:**
- **Cruisers 3 IRC** (2 boats — 5795, 35) is scored over only the **9** race-days
  where **both** boats came; the 6 single-boat days are absent from its table.
- **Cruisers 2 - Sigma 33** (3 boats) is scored over only the days **≥2** of its
  boats came: of the 5 Thursday days it's missing, **4 are single-boat days**
  (12 Jun=0, 26 Jun=1, 31 Jul=1, 28 Aug=1) — exactly the same pattern.
- By contrast **Cruisers 0 ECHO** *keeps* its single-boat day (26 Jun, boat 6888
  scores 1st, the other six score DNC).

That two unrelated fleets drop *precisely* their single-competitor days leans
toward an **automatic** behaviour rather than hand-curation.

**Why we can't just code a rule for it.** "A race doesn't count for a fleet with
fewer than two of its boats" reproduces those two, but it is demonstrably **not**
a general rule:
- it deletes Cruisers 0 ECHO's 26 Jun race, which HalSail keeps; and
- scoped to only fixed-handicap fleets, it still breaks several **2026** IRC /
  VPRS / one-design fleets that likewise keep their single-boat races.

So whatever the mechanism, it treats some fleets/tandems differently from others,
and not along the obvious IRC-vs-ECHO or fixed-vs-progressive lines.

**Question for DBSC.** In 2025, Cruisers 3 IRC and Sigma 33 exclude their
single-competitor races while Cruisers 0 ECHO (and 2026 fixed fleets) keep theirs
— is this a **manual** removal of races from those tandems, or an **automatic**
rule? If automatic, what decides which tandems it applies to?

**Impact / status.** Until answered, those fleets over-score (they count the
single-boat days as DNCs). Everything else in the Thursday cruiser group is
parity-green. By agreement we leave Cruisers 3 IRC at its full 15-race set for now.

---

## 2. Sigma 33 one-design — series ends 14 Aug (2025)

Separate from the single-competitor exclusion above (question 1), the **Sigma 33**
one-design table simply **stops at 14 Aug**, even though all three boats keep
racing in Cruisers 2 ECHO through 28 Aug. In particular **21 Aug** is excluded
*despite all three Sigma boats sailing it* (≥2 — so it's not the question-1
exclusion). The one-design split looks like it was wound up mid-August while the
parent class continued.

**Question for DBSC.** Did the Sigma 33 one-design series deliberately end after
14 Aug (so 21 Aug and 28 Aug aren't part of it), or is something else going on?
