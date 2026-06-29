/**
 * Build the 2025 DBSC season from the archive as Sail Scoring `.sailscoring`
 * files — one per finish-sheet day-group. Machinery lives in
 * lib/halsail/archive-build.ts; this file is just the 2025 day-group configs.
 *
 *   pnpm archive:2025            # build every group
 *   pnpm archive:2025 thursday-cruisers   # one group
 *   pnpm archive:2025 --no-validate
 */

import {
  buildCruiserDaySeries, buildFleetSeries,
  type BuildOptions, type DayFleetSpec, type SeriesFile,
} from '../lib/halsail/to-series';
import { archiveBuilder, type Group } from '../lib/halsail/archive-build';

const { frag, tandemFrags, runMain } = archiveBuilder('2025');

const THURSDAY_CRUISERS: Group = {
  out: 'dbsc-2025-thursday-cruisers', name: 'DBSC 2025 — Thursday Cruisers',
  day: 'Thursday', echoSuffix: 'Thu',
  classNames: [
    'Cruisers 0 IRC', 'Cruisers 0 Echo (Thu)', 'Cruisers 1 IRC', 'Cruisers 1 Echo (Thu)',
    'Cruisers 2 IRC', 'Cruisers 2 Echo (Thu)', 'Cruisers 3 IRC', 'Cruisers 3 Echo (Thu)',
    'Cruisers 1 - J109', 'Cruisers 2 - Sigma33', 'Cruisers 4-5A NS VPRS', 'Cruisers 4-5B NS VPRS',
    'Cruisers 5A Echo (Thu)', 'Cruisers 5B Echo (Thu)',
  ],
  fleetClassOverride: {
    'J/109': 'Cruisers 1 - J109', 'Sigma 33': 'Cruisers 2 - Sigma33',
    'Cruisers 4-5A VPRS': 'Cruisers 4-5A NS VPRS', 'Cruisers 4-5B VPRS': 'Cruisers 4-5B NS VPRS',
    'Cruisers 5A ECHO': 'Cruisers 5A Echo (Thu)', 'Cruisers 5B ECHO': 'Cruisers 5B Echo (Thu)',
  },
  build: (opts) => buildCruiserDaySeries(
    [
      { classNum: 0, echo: frag('Cruisers 0 Echo (Thu)', 'Thursday Overall'), irc: frag('Cruisers 0 IRC', 'Thursday Overall') },
      { classNum: 1, echo: frag('Cruisers 1 Echo (Thu)', 'Thursday Overall'), irc: frag('Cruisers 1 IRC', 'Thursday Overall') },
      { classNum: 2, echo: frag('Cruisers 2 Echo (Thu)', 'Thursday Overall'), irc: frag('Cruisers 2 IRC', 'Thursday Overall') },
      { classNum: 3, echo: frag('Cruisers 3 Echo (Thu)', 'Thursday Overall'), irc: frag('Cruisers 3 IRC', 'Thursday Overall'), echoTandems: tandemFrags('Cruisers 3 Echo (Thu)', 'Thursday') },
    ],
    [
      { fleetId: 'cf-j109', name: 'J/109', parentClass: 1, fleet: frag('Cruisers 1 - J109', 'Thursday Overall') },
      { fleetId: 'cf-sigma33', name: 'Sigma 33', parentClass: 2, fleet: frag('Cruisers 2 - Sigma33', 'Thursday Overall') },
    ],
    opts,
    [
      { vprsFleetId: 'cf-45a-vprs', vprsName: 'Cruisers 4-5A VPRS', startKey: '45a', vprs: frag('Cruisers 4-5A NS VPRS', 'Thursday Overall'), echoFleets: [{ fleetId: 'cf-5a-echo', name: 'Cruisers 5A ECHO', echo: frag('Cruisers 5A Echo (Thu)', 'Thursday Overall') }] },
      { vprsFleetId: 'cf-45b-vprs', vprsName: 'Cruisers 4-5B VPRS', startKey: '45b', vprs: frag('Cruisers 4-5B NS VPRS', 'Thursday Overall'), echoFleets: [{ fleetId: 'cf-5b-echo', name: 'Cruisers 5B ECHO', echo: frag('Cruisers 5B Echo (Thu)', 'Thursday Overall') }] },
    ],
  ),
};

/** Thursday "Red" sheet: one-design / sportsboat / PY classes scored on their
 *  own (scratch / VPRS / PY / progressive-ECHO), each from its own fragment.
 *  Mirrors the 2026 live `thursday-red` build, minus J/80 (no 2025 class). */
const THURSDAY_OD: Group = {
  out: 'dbsc-2025-thursday-od', name: 'DBSC 2025 — Thursday One-designs & Sportsboats',
  day: 'Thursday', echoSuffix: 'Thu',
  classNames: [
    'Dragon', 'Flying Fifteen', 'Ruffian 23', 'SB20', 'Shipman', 'Sportsboats',
    'Glen', 'Glen-Mermaid PY', 'Beneteau 211 Scratch', 'Beneteau 211 Echo (Thu)',
    'Beneteau 31.7 Scratch', 'Beneteau 31.7 Echo (Thu)',
  ],
  fleetClassOverride: {
    'Mixed Sportsboats': 'Sportsboats',
    'Beneteau 211': 'Beneteau 211 Scratch', 'Beneteau 211 ECHO': 'Beneteau 211 Echo (Thu)',
    'Beneteau 31.7': 'Beneteau 31.7 Scratch', 'Beneteau 31.7 ECHO': 'Beneteau 31.7 Echo (Thu)',
  },
  build: (opts) => buildFleetSeries(
    [
      { fleetId: 'fl-dragon', name: 'Dragon', system: 'scratch', fragment: frag('Dragon', 'Thursday Overall') },
      { fleetId: 'fl-ff', name: 'Flying Fifteen', system: 'scratch', fragment: frag('Flying Fifteen', 'Thursday Overall') },
      { fleetId: 'fl-ruffian', name: 'Ruffian 23', system: 'scratch', fragment: frag('Ruffian 23', 'Thursday Overall') },
      { fleetId: 'fl-sb20', name: 'SB20', system: 'scratch', fragment: frag('SB20', 'Thursday Overall') },
      { fleetId: 'fl-shipman', name: 'Shipman', system: 'scratch', fragment: frag('Shipman', 'Thursday Overall') },
      { fleetId: 'fl-sportsboats', name: 'Mixed Sportsboats', system: 'vprs', fragment: frag('Sportsboats', 'Thursday Overall') },
      { fleetId: 'fl-glen', name: 'Glen', system: 'scratch', fragment: frag('Glen', 'Thursday Overall') },
      { fleetId: 'fl-glenmermaid-py', name: 'Glen-Mermaid PY', system: 'py', fragment: frag('Glen-Mermaid PY', 'Thursday Overall') },
      { fleetId: 'fl-b211', name: 'Beneteau 211', system: 'scratch', fragment: frag('Beneteau 211 Scratch', 'Thursday Overall') },
      { fleetId: 'fl-b211-echo', name: 'Beneteau 211 ECHO', system: 'echo', fragment: frag('Beneteau 211 Echo (Thu)', 'Thursday Overall') },
      { fleetId: 'fl-b317', name: 'Beneteau 31.7', system: 'scratch', fragment: frag('Beneteau 31.7 Scratch', 'Thursday Overall') },
      { fleetId: 'fl-b317-echo', name: 'Beneteau 31.7 ECHO', system: 'echo', fragment: frag('Beneteau 31.7 Echo (Thu)', 'Thursday Overall') },
    ] satisfies DayFleetSpec[],
    opts,
  ),
};

// Saturday cruisers — identical structure to Thursday, Saturday fragments.
const SATURDAY_CRUISERS: Group = {
  out: 'dbsc-2025-saturday-cruisers', name: 'DBSC 2025 — Saturday Cruisers',
  day: 'Saturday', echoSuffix: 'Sat',
  classNames: [
    'Cruisers 0 IRC', 'Cruisers 0 Echo (Sat)', 'Cruisers 1 IRC', 'Cruisers 1 Echo (Sat)',
    'Cruisers 2 IRC', 'Cruisers 2 Echo (Sat)', 'Cruisers 3 IRC', 'Cruisers 3 Echo (Sat)',
    'Cruisers 1 - J109', 'Cruisers 2 - Sigma33', 'Cruisers 4-5A NS VPRS', 'Cruisers 4-5B NS VPRS',
    'Cruisers 5A Echo (Sat)', 'Cruisers 5B Echo (Sat)',
  ],
  fleetClassOverride: {
    'J/109': 'Cruisers 1 - J109', 'Sigma 33': 'Cruisers 2 - Sigma33',
    'Cruisers 4-5A VPRS': 'Cruisers 4-5A NS VPRS', 'Cruisers 4-5B VPRS': 'Cruisers 4-5B NS VPRS',
    'Cruisers 5A ECHO': 'Cruisers 5A Echo (Sat)', 'Cruisers 5B ECHO': 'Cruisers 5B Echo (Sat)',
  },
  build: (opts) => buildCruiserDaySeries(
    [
      { classNum: 0, echo: frag('Cruisers 0 Echo (Sat)', 'Saturday Overall'), irc: frag('Cruisers 0 IRC', 'Saturday Overall') },
      { classNum: 1, echo: frag('Cruisers 1 Echo (Sat)', 'Saturday Overall'), irc: frag('Cruisers 1 IRC', 'Saturday Overall') },
      { classNum: 2, echo: frag('Cruisers 2 Echo (Sat)', 'Saturday Overall'), irc: frag('Cruisers 2 IRC', 'Saturday Overall') },
      { classNum: 3, echo: frag('Cruisers 3 Echo (Sat)', 'Saturday Overall'), irc: frag('Cruisers 3 IRC', 'Saturday Overall') },
    ],
    [
      { fleetId: 'cf-j109', name: 'J/109', parentClass: 1, fleet: frag('Cruisers 1 - J109', 'Saturday Overall') },
      { fleetId: 'cf-sigma33', name: 'Sigma 33', parentClass: 2, fleet: frag('Cruisers 2 - Sigma33', 'Saturday Overall') },
    ],
    opts,
    [
      { vprsFleetId: 'cf-45a-vprs', vprsName: 'Cruisers 4-5A VPRS', startKey: '45a', vprs: frag('Cruisers 4-5A NS VPRS', 'Saturday Overall'), echoFleets: [{ fleetId: 'cf-5a-echo', name: 'Cruisers 5A ECHO', echo: frag('Cruisers 5A Echo (Sat)', 'Saturday Overall') }] },
      { vprsFleetId: 'cf-45b-vprs', vprsName: 'Cruisers 4-5B VPRS', startKey: '45b', vprs: frag('Cruisers 4-5B NS VPRS', 'Saturday Overall'), echoFleets: [{ fleetId: 'cf-5b-echo', name: 'Cruisers 5B ECHO', echo: frag('Cruisers 5B Echo (Sat)', 'Saturday Overall') }] },
    ],
  ),
};

// Saturday "One-designs, Sportsboats & PY" sheet — the biggest day. Mirrors the
// 2026 saturday-od, minus J/80; plus Melges 15 (a 2025 scratch one-design).
const SATURDAY_OD: Group = {
  out: 'dbsc-2025-saturday-od', name: 'DBSC 2025 — Saturday One-designs, Sportsboats & PY',
  day: 'Saturday', echoSuffix: 'Sat',
  classNames: [
    'Dragon', 'Flying Fifteen', 'Ruffian 23', 'SB20', 'Shipman', 'Sportsboats',
    'Glen', 'Glen-Mermaid PY', 'Beneteau 211 Scratch', 'Beneteau 211 Echo (Sat)',
    'Beneteau 31.7 Scratch', 'Beneteau 31.7 Echo (Sat)', 'Dublin Bay 21', 'Fireball',
    'IDRA 14', 'ILCA 7', 'ILCA 6', 'PY Class', 'Melges 15',
  ],
  fleetClassOverride: {
    'Mixed Sportsboats': 'Sportsboats',
    'Beneteau 211': 'Beneteau 211 Scratch', 'Beneteau 211 ECHO': 'Beneteau 211 Echo (Sat)',
    'Beneteau 31.7': 'Beneteau 31.7 Scratch', 'Beneteau 31.7 ECHO': 'Beneteau 31.7 Echo (Sat)',
  },
  build: (opts) => buildFleetSeries(
    [
      { fleetId: 'fl-dragon', name: 'Dragon', system: 'scratch', fragment: frag('Dragon', 'Saturday Overall'), tandemFragments: tandemFrags('Dragon', 'Saturday') },
      { fleetId: 'fl-ff', name: 'Flying Fifteen', system: 'scratch', fragment: frag('Flying Fifteen', 'Saturday Overall') },
      { fleetId: 'fl-ruffian', name: 'Ruffian 23', system: 'scratch', fragment: frag('Ruffian 23', 'Saturday Overall') },
      { fleetId: 'fl-sb20', name: 'SB20', system: 'scratch', fragment: frag('SB20', 'Saturday Overall'), tandemFragments: tandemFrags('SB20', 'Saturday') },
      { fleetId: 'fl-shipman', name: 'Shipman', system: 'scratch', fragment: frag('Shipman', 'Saturday Overall') },
      { fleetId: 'fl-sportsboats', name: 'Mixed Sportsboats', system: 'vprs', fragment: frag('Sportsboats', 'Saturday Overall'), tandemFragments: tandemFrags('Sportsboats', 'Saturday') },
      { fleetId: 'fl-glen', name: 'Glen', system: 'scratch', fragment: frag('Glen', 'Saturday Overall') },
      { fleetId: 'fl-glenmermaid-py', name: 'Glen-Mermaid PY', system: 'py', fragment: frag('Glen-Mermaid PY', 'Saturday Overall') },
      { fleetId: 'fl-b211', name: 'Beneteau 211', system: 'scratch', fragment: frag('Beneteau 211 Scratch', 'Saturday Overall') },
      { fleetId: 'fl-b211-echo', name: 'Beneteau 211 ECHO', system: 'echo', fragment: frag('Beneteau 211 Echo (Sat)', 'Saturday Overall') },
      { fleetId: 'fl-b317', name: 'Beneteau 31.7', system: 'scratch', fragment: frag('Beneteau 31.7 Scratch', 'Saturday Overall') },
      { fleetId: 'fl-b317-echo', name: 'Beneteau 31.7 ECHO', system: 'echo', fragment: frag('Beneteau 31.7 Echo (Sat)', 'Saturday Overall') },
      { fleetId: 'fl-db21', name: 'Dublin Bay 21', system: 'scratch', fragment: frag('Dublin Bay 21', 'Saturday Overall') },
      { fleetId: 'fl-fireball', name: 'Fireball', system: 'scratch', fragment: frag('Fireball', 'Saturday Overall') },
      { fleetId: 'fl-idra14', name: 'IDRA 14', system: 'scratch', fragment: frag('IDRA 14', 'Saturday Overall') },
      { fleetId: 'fl-ilca7', name: 'ILCA 7', system: 'scratch', fragment: frag('ILCA 7', 'Saturday Overall') },
      { fleetId: 'fl-ilca6', name: 'ILCA 6', system: 'scratch', fragment: frag('ILCA 6', 'Saturday Overall') },
      { fleetId: 'fl-pyclass', name: 'PY Class', system: 'py', fragment: frag('PY Class', 'Saturday Overall') },
      { fleetId: 'fl-melges15', name: 'Melges 15', system: 'scratch', fragment: frag('Melges 15', 'Saturday Overall') },
    ] satisfies DayFleetSpec[],
    opts,
  ),
};

// Water Wags (Wednesday): one scratch one-design fleet. The "Overall" tandem is
// named "2025 Summer Series" and the race-subset tandems are 2025 Series A/B/C —
// the first N-block (three-block) group, exercising the generalised sub-series.
const WATER_WAGS: Group = {
  out: 'dbsc-2025-water-wags', name: 'DBSC 2025 — Water Wags',
  day: '2025', echoSuffix: '',
  overallName: 'Summer Series',
  blockNames: ['Series A', 'Series B', 'Series C'],
  classNames: ['Water Wag'],
  fleetClassOverride: {},
  build: (opts) => buildFleetSeries(
    [
      {
        fleetId: 'fl-waterwag', name: 'Water Wag', system: 'scratch',
        fragment: frag('Water Wag', '2025 Summer Series'),
        tandemFragments: tandemFrags('Water Wag', '2025', ['Series A', 'Series B', 'Series C']),
      },
    ] satisfies DayFleetSpec[],
    opts,
  ),
};

// Tuesday "One-designs, Sportsboats & PY" sheet. One vessel / one sheet, so all
// these fleets share the Tuesday races. The one-designs publish Tuesday Overall +
// Series A/B/C; Women on the Water re-scores the same finishes under a PY-style
// time-on-time handicap and publishes under "2025 Summer Series" — hence the
// explicit subSeriesNames (each auto-scopes to the fleets that publish it).
const TUESDAY_OD: Group = {
  out: 'dbsc-2025-tuesday-od', name: 'DBSC 2025 — Tuesday One-designs, Sportsboats & PY',
  day: 'Tuesday', echoSuffix: 'Tue',
  subSeriesNames: ['Tuesday Overall', 'Tuesday Series A', 'Tuesday Series B', 'Tuesday Series C', { name: '2025 Summer Series', fleetIds: ['fl-wow'] }],
  classNames: [],
  fleetClassOverride: {
    'Mixed Sportsboats': 'Sportsboats',
    'Beneteau 211': 'Beneteau 211 Scratch', 'Beneteau 211 ECHO': 'Beneteau 211 Echo (Tue)',
    'Women on the Water': 'Women on the Water (Tue)',
  },
  build: (opts) => buildFleetSeries(
    [
      { fleetId: 'fl-fireball', name: 'Fireball', system: 'scratch', fragment: frag('Fireball', 'Tuesday Overall'), tandemFragments: tandemFrags('Fireball', 'Tuesday', ['Series A', 'Series B', 'Series C']) },
      { fleetId: 'fl-idra14', name: 'IDRA 14', system: 'scratch', fragment: frag('IDRA 14', 'Tuesday Overall'), tandemFragments: tandemFrags('IDRA 14', 'Tuesday', ['Series A', 'Series B', 'Series C']) },
      { fleetId: 'fl-ilca7', name: 'ILCA 7', system: 'scratch', fragment: frag('ILCA 7', 'Tuesday Overall'), tandemFragments: tandemFrags('ILCA 7', 'Tuesday', ['Series A', 'Series B', 'Series C']) },
      { fleetId: 'fl-ilca6', name: 'ILCA 6', system: 'scratch', fragment: frag('ILCA 6', 'Tuesday Overall'), tandemFragments: tandemFrags('ILCA 6', 'Tuesday', ['Series A', 'Series B', 'Series C']) },
      { fleetId: 'fl-melges15', name: 'Melges 15', system: 'scratch', fragment: frag('Melges 15', 'Tuesday Overall'), tandemFragments: tandemFrags('Melges 15', 'Tuesday', ['Series A', 'Series B', 'Series C']) },
      { fleetId: 'fl-pyclass', name: 'PY Class', system: 'py', fragment: frag('PY Class', 'Tuesday Overall'), tandemFragments: tandemFrags('PY Class', 'Tuesday', ['Series A', 'Series B', 'Series C']) },
      { fleetId: 'fl-db21', name: 'Dublin Bay 21', system: 'scratch', fragment: frag('Dublin Bay 21', 'Tuesday Overall') },
      { fleetId: 'fl-ff', name: 'Flying Fifteen', system: 'scratch', fragment: frag('Flying Fifteen', 'Tuesday Overall') },
      { fleetId: 'fl-glen', name: 'Glen', system: 'scratch', fragment: frag('Glen', 'Tuesday Overall') },
      { fleetId: 'fl-glenmermaid-py', name: 'Glen-Mermaid PY', system: 'py', fragment: frag('Glen-Mermaid PY', 'Tuesday Overall') },
      { fleetId: 'fl-ruffian', name: 'Ruffian 23', system: 'scratch', fragment: frag('Ruffian 23', 'Tuesday Overall') },
      { fleetId: 'fl-sb20', name: 'SB20', system: 'scratch', fragment: frag('SB20', 'Tuesday Overall') },
      { fleetId: 'fl-sportsboats', name: 'Mixed Sportsboats', system: 'vprs', fragment: frag('Sportsboats', 'Tuesday Overall') },
      { fleetId: 'fl-b211', name: 'Beneteau 211', system: 'scratch', fragment: frag('Beneteau 211 Scratch', 'Tuesday Overall') },
      { fleetId: 'fl-b211-echo', name: 'Beneteau 211 ECHO', system: 'echo', fragment: frag('Beneteau 211 Echo (Tue)', 'Tuesday Overall') },
      { fleetId: 'fl-wow', name: 'Women on the Water', system: 'vprs', fragment: frag('Women on the Water (Tue)', '2025 Summer Series') },
    ] satisfies DayFleetSpec[],
    opts,
  ),
};

// Tuesday cruisers: no IRC/one-design splits — the boats fold into pools. The
// "Combined Cruisers" (C0/1/2 progressive ECHO) and "Combined Group 2" (a fixed
// time-on-time coefficient, like VPRS) pools publish under "2025 Summer Series";
// Cruisers 3 keeps its own ECHO + IRC under "Tuesday Overall". A boat can sit in
// a pool and in its class fleet at once, scored independently in each.
const TUESDAY_CRUISERS: Group = {
  out: 'dbsc-2025-tuesday-cruisers', name: 'DBSC 2025 — Tuesday Cruisers',
  day: 'Tuesday', echoSuffix: 'Tue',
  subSeriesNames: ['Tuesday Overall', { name: '2025 Summer Series', fleetIds: ['cf-combined', 'cf-cg2'] }],
  classNames: [],
  fleetClassOverride: {
    'Combined Cruisers': 'Combined Cruisers (Tue)',
    'Combined Group 2': 'Combined Group 2 (Tue)',
  },
  build: (opts) => buildFleetSeries(
    [
      { fleetId: 'cf-combined', name: 'Combined Cruisers', system: 'echo', fragment: frag('Combined Cruisers (Tue)', '2025 Summer Series') },
      { fleetId: 'cf-cg2', name: 'Combined Group 2', system: 'vprs', fragment: frag('Combined Group 2 (Tue)', '2025 Summer Series') },
      { fleetId: 'cf-c3-echo', name: 'Cruisers 3 ECHO', system: 'echo', fragment: frag('Cruisers 3 Echo (Tue)', 'Tuesday Overall') },
      { fleetId: 'cf-c3-irc', name: 'Cruisers 3 IRC', system: 'irc', fragment: frag('Cruisers 3 IRC', 'Tuesday Overall') },
    ] satisfies DayFleetSpec[],
    opts,
  ),
};

const GROUPS: Record<string, Group> = {
  'thursday-cruisers': THURSDAY_CRUISERS,
  'thursday-od': THURSDAY_OD,
  'saturday-cruisers': SATURDAY_CRUISERS,
  'saturday-od': SATURDAY_OD,
  'water-wags': WATER_WAGS,
  'tuesday-od': TUESDAY_OD,
  'tuesday-cruisers': TUESDAY_CRUISERS,
};

runMain(GROUPS);
