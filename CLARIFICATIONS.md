# Questions for DBSC

Open questions about how DBSC's published HalSail results were modelled that we
**can't resolve from the data alone**. DBSC has offered to help. Each answer lets
us reproduce the affected results exactly and informs the general reconstruction.

Add to this list whenever the reconstruction hits a divergence that comes down to
a HalSail/scoring decision rather than a bug on our side.

---

## 1. Single-competitor races — excluded for Cruisers 3 IRC, kept for ECHO (2025)

**What we see.** In 2025, **Cruisers 3 IRC** (2 boats — sails 5795 and 35) is
scored over only the **9** race-days where **both** boats came to the line; the 6
days when only one of them raced are absent from its published table. But
**Cruisers 0 ECHO** *keeps* its single-boat day — 26 Jun, where only boat 6888
came: it scores 1st and the other six boats score DNC.

**Why we can't just code a rule for it.** "A race doesn't count for a fleet with
fewer than two of its boats" reproduces Cruisers 3 IRC, but it is demonstrably
**not** a general rule:
- it deletes Cruisers 0 ECHO's 26 Jun race, which HalSail keeps; and
- scoped to only fixed-handicap fleets, it still breaks several **2026** IRC /
  VPRS / one-design fleets that likewise keep their single-boat races.

So the exclusion is narrower than "fixed vs progressive" or "IRC vs ECHO".

**Question for DBSC.** In 2025, Cruisers 3 IRC excludes single-competitor races
while Cruisers 0 ECHO doesn't — was that a **manual** exclusion (races removed
from the Cruisers 3 IRC tandem), or an **automatic** rule? If automatic, what
decides it, given other fixed-handicap fleets keep their single-boat races?

**Impact / status.** Until answered, our Cruisers 3 IRC reconstruction
over-scores (it counts all 15 cruiser-3 days, with DNCs, instead of the published
9). Everything else in the Thursday cruiser group is parity-green.

---

## 2. Sigma 33 — diverges with no single-competitor races (2025) — *investigating*

**Cruisers 2 - Sigma 33** (3 boats) has ≥2 boats in every race, so question 1
doesn't apply, yet our reconstructed net diverges from the published table. We
have **not** yet pinned down whether this is a HalSail modelling decision or a bug
on our side, so it's parked here as a candidate question pending our own
investigation. Don't raise with DBSC until we've ruled out our own converter.
