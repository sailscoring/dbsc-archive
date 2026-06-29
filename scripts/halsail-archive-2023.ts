/**
 * Build the 2023 DBSC season from the archive. Machinery lives in
 * lib/halsail/archive-build.ts; this file is just the 2023 day-group configs.
 *
 * 2023 cruisers differ from 2024/2025: there is no VPRS — Cruisers 5 is scored
 * under IRC + ECHO (per-sub-fleet and an A+B pool), so the cruiser sheets use the
 * general buildFleetSeries (each fleet a system + fragment) rather than the
 * VPRS-shaped buildCruiserDaySeries. One-designs swap ILCA for Laser
 * Radial/Standard, drop Melges 15 / Glen-Mermaid PY, and add Squib-Mermaid.
 *
 *   pnpm archive:2023            # build every group
 *   pnpm archive:2023 thursday-cruisers
 */

import { buildFleetSeries, type DayFleetSpec } from '../lib/halsail/to-series';
import { archiveBuilder, type Group } from '../lib/halsail/archive-build';

const { frag, tandemFrags, runMain } = archiveBuilder('2023');

/** The ECHO + IRC + one-design cruiser fleets shared shape for Thursday/Saturday.
 *  `d` is the day word, `suf` the ECHO-fragment suffix. C5 is IRC/ECHO (no VPRS);
 *  Saturday additionally publishes the 5(A+B) pools. */
function cruiserFleets(d: string, suf: string, saturday: boolean): DayFleetSpec[] {
  const tf = (cn: string) => tandemFrags(cn, d);
  const fleets: DayFleetSpec[] = [];
  for (const n of [0, 1, 2, 3]) {
    fleets.push({ fleetId: `cf-${n}-echo`, name: `Cruisers ${n} ECHO`, system: 'echo', fragment: frag(`Cruisers ${n} Echo (${suf})`, `${d} Overall`), tandemFragments: tf(`Cruisers ${n} Echo (${suf})`) });
    fleets.push({ fleetId: `cf-${n}-irc`, name: `Cruisers ${n} IRC`, system: 'irc', fragment: frag('Cruisers ' + n + ' IRC', `${d} Overall`), tandemFragments: tf(`Cruisers ${n} IRC`) });
  }
  fleets.push({ fleetId: 'cf-j109', name: 'J/109', system: 'scratch', fragment: frag('Cruisers 1 - J109', `${d} Overall`), tandemFragments: tf('Cruisers 1 - J109') });
  fleets.push({ fleetId: 'cf-sigma33', name: 'Sigma 33', system: 'scratch', fragment: frag('Cruisers 2 - Sigma33', `${d} Overall`), tandemFragments: tf('Cruisers 2 - Sigma33') });
  fleets.push({ fleetId: 'cf-5a-echo', name: 'Cruisers 5A ECHO', system: 'echo', fragment: frag(`Cruisers 5A Echo (${suf})`, `${d} Overall`), tandemFragments: tf(`Cruisers 5A Echo (${suf})`) });
  fleets.push({ fleetId: 'cf-5a-irc', name: 'Cruisers 5A IRC', system: 'irc', fragment: frag(`Cruisers 5A NS IRC (${suf})`, `${d} Overall`), tandemFragments: tf(`Cruisers 5A NS IRC (${suf})`) });
  fleets.push({ fleetId: 'cf-5b-echo', name: 'Cruisers 5B ECHO', system: 'echo', fragment: frag(`Cruisers 5B Echo (${suf})`, `${d} Overall`), tandemFragments: tf(`Cruisers 5B Echo (${suf})`) });
  if (saturday) {
    fleets.push({ fleetId: 'cf-5-echo', name: 'Cruisers 5 ECHO', system: 'echo', fragment: frag('Cruisers 5 (A+B) Echo (Sat)', 'Saturday Overall'), tandemFragments: tandemFrags('Cruisers 5 (A+B) Echo (Sat)', 'Saturday') });
    fleets.push({ fleetId: 'cf-5-irc', name: 'Cruisers 5 IRC', system: 'irc', fragment: frag('Cruisers 5 (A+B) NS IRC (Sat)', 'Saturday Overall'), tandemFragments: tandemFrags('Cruisers 5 (A+B) NS IRC (Sat)', 'Saturday') });
  }
  return fleets;
}

const cruiserOverride = (suf: string): Record<string, string> => ({
  'Cruisers 5A ECHO': `Cruisers 5A Echo (${suf})`,
  'Cruisers 5A IRC': `Cruisers 5A NS IRC (${suf})`,
  'Cruisers 5B ECHO': `Cruisers 5B Echo (${suf})`,
  'Cruisers 5 ECHO': 'Cruisers 5 (A+B) Echo (Sat)',
  'Cruisers 5 IRC': 'Cruisers 5 (A+B) NS IRC (Sat)',
  'J/109': 'Cruisers 1 - J109',
  'Sigma 33': 'Cruisers 2 - Sigma33',
});

const THURSDAY_CRUISERS: Group = {
  out: 'dbsc-2023-thursday-cruisers', name: 'DBSC 2023 — Thursday Cruisers',
  day: 'Thursday', echoSuffix: 'Thu', classNames: [],
  fleetClassOverride: cruiserOverride('Thu'),
  build: (opts) => buildFleetSeries(cruiserFleets('Thursday', 'Thu', false), opts),
};

const SATURDAY_CRUISERS: Group = {
  out: 'dbsc-2023-saturday-cruisers', name: 'DBSC 2023 — Saturday Cruisers',
  day: 'Saturday', echoSuffix: 'Sat', classNames: [],
  fleetClassOverride: cruiserOverride('Sat'),
  build: (opts) => buildFleetSeries(cruiserFleets('Saturday', 'Sat', true), opts),
};

/** One-design / sportsboat / PY day sheet. `d` the day word; `extra` the
 *  day-specific fleets (Saturday adds the dinghies + PY). */
function odFleets(d: string, extra: DayFleetSpec[]): DayFleetSpec[] {
  const tf = (cn: string, blocks?: string[]) => tandemFrags(cn, d, blocks);
  return [
    { fleetId: 'fl-dragon', name: 'Dragon', system: 'scratch', fragment: frag('Dragon', `${d} Overall`), tandemFragments: tf('Dragon') },
    { fleetId: 'fl-ff', name: 'Flying Fifteen', system: 'scratch', fragment: frag('Flying Fifteen', `${d} Overall`), tandemFragments: tf('Flying Fifteen') },
    { fleetId: 'fl-ruffian', name: 'Ruffian 23', system: 'scratch', fragment: frag('Ruffian 23', `${d} Overall`), tandemFragments: tf('Ruffian 23') },
    { fleetId: 'fl-sb20', name: 'SB20', system: 'scratch', fragment: frag('SB20', `${d} Overall`), tandemFragments: tf('SB20') },
    { fleetId: 'fl-shipman', name: 'Shipman', system: 'scratch', fragment: frag('Shipman', `${d} Overall`), tandemFragments: tf('Shipman') },
    { fleetId: 'fl-sportsboats', name: 'Mixed Sportsboats', system: 'vprs', fragment: frag('Sportsboats', `${d} Overall`), tandemFragments: tf('Sportsboats') },
    { fleetId: 'fl-glen', name: 'Glen', system: 'scratch', fragment: frag('Glen', `${d} Overall`), tandemFragments: tf('Glen') },
    { fleetId: 'fl-b211', name: 'Beneteau 211', system: 'scratch', fragment: frag('Beneteau 211 Scratch', `${d} Overall`) },
    { fleetId: 'fl-b211-echo', name: 'Beneteau 211 ECHO', system: 'echo', fragment: frag(`Beneteau 211 Echo (${d.slice(0, 3)})`, `${d} Overall`) },
    { fleetId: 'fl-b317', name: 'Beneteau 31.7', system: 'scratch', fragment: frag('Beneteau 31.7 Scratch', `${d} Overall`) },
    { fleetId: 'fl-b317-echo', name: 'Beneteau 31.7 ECHO', system: 'echo', fragment: frag(`Beneteau 31.7 Echo (${d.slice(0, 3)})`, `${d} Overall`) },
    ...extra,
  ];
}

const odOverride: Record<string, string> = {
  'Mixed Sportsboats': 'Sportsboats',
  'Beneteau 211': 'Beneteau 211 Scratch', 'Beneteau 211 ECHO': 'Beneteau 211 Echo (Thu)',
  'Beneteau 31.7': 'Beneteau 31.7 Scratch', 'Beneteau 31.7 ECHO': 'Beneteau 31.7 Echo (Thu)',
};

const THURSDAY_OD: Group = {
  out: 'dbsc-2023-thursday-od', name: 'DBSC 2023 — Thursday One-designs & Sportsboats',
  day: 'Thursday', echoSuffix: 'Thu', classNames: [],
  fleetClassOverride: odOverride,
  build: (opts) => buildFleetSeries(odFleets('Thursday', []), opts),
};

const SATURDAY_OD: Group = {
  out: 'dbsc-2023-saturday-od', name: 'DBSC 2023 — Saturday One-designs, Sportsboats & PY',
  day: 'Saturday', echoSuffix: 'Sat', classNames: [],
  fleetClassOverride: { ...odOverride, 'Beneteau 211 ECHO': 'Beneteau 211 Echo (Sat)', 'Beneteau 31.7 ECHO': 'Beneteau 31.7 Echo (Sat)' },
  build: (opts) => buildFleetSeries(odFleets('Saturday', [
    { fleetId: 'fl-db21', name: 'Dublin Bay 21', system: 'scratch', fragment: frag('Dublin Bay 21', 'Saturday Overall'), tandemFragments: tandemFrags('Dublin Bay 21', 'Saturday') },
    { fleetId: 'fl-fireball', name: 'Fireball', system: 'scratch', fragment: frag('Fireball', 'Saturday Overall'), tandemFragments: tandemFrags('Fireball', 'Saturday') },
    { fleetId: 'fl-idra14', name: 'IDRA 14', system: 'scratch', fragment: frag('IDRA 14', 'Saturday Overall'), tandemFragments: tandemFrags('IDRA 14', 'Saturday') },
    { fleetId: 'fl-laser-std', name: 'Laser Standard', system: 'scratch', fragment: frag('Laser Standard', 'Saturday Overall'), tandemFragments: tandemFrags('Laser Standard', 'Saturday') },
    { fleetId: 'fl-laser-rad', name: 'Laser Radial', system: 'scratch', fragment: frag('Laser Radial', 'Saturday Overall'), tandemFragments: tandemFrags('Laser Radial', 'Saturday') },
    { fleetId: 'fl-squib-mermaid', name: 'Squib-Mermaid', system: 'scratch', fragment: frag('Squib-Mermaid', 'Saturday Overall'), tandemFragments: tandemFrags('Squib-Mermaid', 'Saturday') },
    { fleetId: 'fl-pyclass', name: 'PY Class', system: 'py', fragment: frag('PY Class', 'Saturday Overall'), tandemFragments: tandemFrags('PY Class', 'Saturday') },
  ]), opts),
};

const WATER_WAGS: Group = {
  out: 'dbsc-2023-water-wags', name: 'DBSC 2023 — Water Wags',
  day: '2023', echoSuffix: '', classNames: ['Water Wag'], fleetClassOverride: {},
  subSeriesNames: ['2023 Summer Series', 'Weds Series A', 'Weds Series B', 'Weds Series C'],
  build: (opts) => buildFleetSeries(
    [{ fleetId: 'fl-waterwag', name: 'Water Wag', system: 'scratch', fragment: frag('Water Wag', '2023 Summer Series'), tandemFragments: tandemFrags('Water Wag', 'Weds', ['Series A', 'Series B', 'Series C']) }],
    opts,
  ),
};

const TUESDAY_OD: Group = {
  out: 'dbsc-2023-tuesday-od', name: 'DBSC 2023 — Tuesday One-designs, Sportsboats & PY',
  day: 'Tuesday', echoSuffix: 'Tue', classNames: [],
  subSeriesNames: ['Tuesday Overall', 'Tuesday Series A', 'Tuesday Series B', 'Tuesday Series C'],
  fleetClassOverride: {
    'Mixed Sportsboats': 'Sportsboats',
    'Beneteau 211': 'Beneteau 211 Scratch', 'Beneteau 211 ECHO': 'Beneteau 211 Echo (Tue)',
    'Women on the Water': 'Women on the Water (Tue)',
  },
  build: (opts) => {
    const tf = (cn: string) => tandemFrags(cn, 'Tuesday', ['Series A', 'Series B', 'Series C']);
    return buildFleetSeries([
      { fleetId: 'fl-fireball', name: 'Fireball', system: 'scratch', fragment: frag('Fireball', 'Tuesday Overall'), tandemFragments: tf('Fireball') },
      { fleetId: 'fl-idra14', name: 'IDRA 14', system: 'scratch', fragment: frag('IDRA 14', 'Tuesday Overall'), tandemFragments: tf('IDRA 14') },
      { fleetId: 'fl-laser-std', name: 'Laser Standard', system: 'scratch', fragment: frag('Laser Standard', 'Tuesday Overall'), tandemFragments: tf('Laser Standard') },
      { fleetId: 'fl-laser-rad', name: 'Laser Radial', system: 'scratch', fragment: frag('Laser Radial', 'Tuesday Overall'), tandemFragments: tf('Laser Radial') },
      { fleetId: 'fl-pyclass', name: 'PY Class', system: 'py', fragment: frag('PY Class', 'Tuesday Overall'), tandemFragments: tf('PY Class') },
      { fleetId: 'fl-db21', name: 'Dublin Bay 21', system: 'scratch', fragment: frag('Dublin Bay 21', 'Tuesday Overall') },
      { fleetId: 'fl-ff', name: 'Flying Fifteen', system: 'scratch', fragment: frag('Flying Fifteen', 'Tuesday Overall') },
      { fleetId: 'fl-glen', name: 'Glen', system: 'scratch', fragment: frag('Glen', 'Tuesday Overall') },
      { fleetId: 'fl-ruffian', name: 'Ruffian 23', system: 'scratch', fragment: frag('Ruffian 23', 'Tuesday Overall') },
      { fleetId: 'fl-sb20', name: 'SB20', system: 'scratch', fragment: frag('SB20', 'Tuesday Overall') },
      { fleetId: 'fl-sportsboats', name: 'Mixed Sportsboats', system: 'vprs', fragment: frag('Sportsboats', 'Tuesday Overall') },
      { fleetId: 'fl-b211-echo', name: 'Beneteau 211 ECHO', system: 'echo', fragment: frag('Beneteau 211 Echo (Tue)', 'Tuesday Overall') },
      { fleetId: 'fl-wow', name: 'Women on the Water', system: 'vprs', fragment: frag('Women on the Water (Tue)', 'Tuesday Overall') },
    ] satisfies DayFleetSpec[], opts);
  },
};

const TUESDAY_CRUISERS: Group = {
  out: 'dbsc-2023-tuesday-cruisers', name: 'DBSC 2023 — Tuesday Cruisers',
  day: 'Tuesday', echoSuffix: 'Tue', classNames: [],
  subSeriesNames: ['Tuesday Overall', { name: '2023 Summer Series', fleetIds: ['cf-combined'] }],
  fleetClassOverride: { 'Combined Cruisers': 'Combined Cruisers (Tue)' },
  build: (opts) => buildFleetSeries([
    { fleetId: 'cf-combined', name: 'Combined Cruisers', system: 'echo', fragment: frag('Combined Cruisers (Tue)', '2023 Summer Series') },
    { fleetId: 'cf-c3-echo', name: 'Cruisers 3 ECHO', system: 'echo', fragment: frag('Cruisers 3 Echo (Tue)', 'Tuesday Overall') },
    { fleetId: 'cf-c3-irc', name: 'Cruisers 3 IRC', system: 'irc', fragment: frag('Cruisers 3 IRC', 'Tuesday Overall') },
  ] satisfies DayFleetSpec[], opts),
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
