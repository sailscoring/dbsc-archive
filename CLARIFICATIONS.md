# Questions for DBSC

Open questions about how DBSC's published HalSail results were modelled that we
**can't resolve from the data alone**. DBSC has offered to help. Each answer lets
us reproduce the affected results exactly and informs the general reconstruction.

Add to this list whenever the reconstruction hits a divergence that comes down to
a HalSail/scoring decision rather than a bug on our side.

---

## 1. Single-competitor races — excluded for Cruisers 3 IRC, kept for ECHO (2025)

**What we see — confirmed on three independent fleets, with a clear pattern:**

| Fleet | What it is | Its single-boat day(s) |
|---|---|---|
| Cruisers 3 IRC | IRC tandem (the 2 IRC-rated boats of Cruisers 3) | **excluded** (9 of 15 days kept) |
| Cruisers 2 - Sigma 33 | one-design split of Cruisers 2 | **excluded** (12 Jun, 26 Jun, 31 Jul, 28 Aug) |
| Cruisers 5A ECHO | ECHO sub-fleet of the combined 4-5A VPRS pool | **excluded** (05 Jun — only boat 8237 of the 5A boats raced) |
| Cruisers 0 ECHO | the Cruisers 0 class's own series (own start) | **kept** (26 Jun — boat 6888 scores 1st, the rest DNC) |
| Cruisers 3 ECHO | the Cruisers 3 class's own series | **kept** |

The three that **exclude** are all **secondary tandems / splits / sub-fleets**
drawn from a larger combined start; the two that **keep** are **primary classes
with their own start**. So the distinction is *not* IRC-vs-ECHO or
fixed-vs-progressive (5A ECHO and 0 ECHO are both ECHO, yet differ) — it tracks
**tandem/sub-fleet vs primary class**.

**Why we can't just code a rule for it.** A blanket "a race needs ≥2 of a fleet's
boats" deletes Cruisers 0 ECHO's 26 Jun (which HalSail keeps), and even scoped to
fixed-handicap fleets it breaks several **2026** primary fleets that keep their
single-boat races. Only the tandem/sub-fleet distinction fits all the data — and
the engine doesn't currently know which fleets are secondary tandems.

**Question for DBSC.** In 2025, the secondary tandems / one-design splits /
sub-fleets (Cruisers 3 IRC, Sigma 33, Cruisers 5A ECHO) drop their
single-competitor races, while the primary class series (Cruisers 0/3 ECHO) keep
theirs. Is that a **manual** removal of those races from the tandems, or an
**automatic** rule that fires for secondary tandems but not primary classes?

**Impact / status.** Until answered, those three fleets over-score (they count
the single-boat days, as DNCs). Everything else in the Thursday cruiser group is
parity-green. By agreement we leave them at their full race-sets for now.

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
