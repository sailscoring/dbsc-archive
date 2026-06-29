/**
 * Build the 2022 DBSC season from the archive. Machinery in
 * lib/halsail/archive-build.ts; this file is the 2022 day-group configs.
 *
 * Like 2023, 2022 has no VPRS — Cruisers 4/5 are scored under IRC + ECHO, but
 * grouped differently: a "Cruisers 4 (+5A)" pool plus per-sub-fleet 5A/5B
 * (Thursday) and a "Cruisers 5 (A+B)" pool (Saturday). Water Wags publish
 * "Wednesday Overall" + "Wednesday Series A/B/C"; Combined Cruisers and Cruisers 3
 * fold into "Tuesday Overall". One-designs are Laser Radial/Standard (no ILCA),
 * Squib-Mermaid, no Melges 15 / Glen-Mermaid PY.
 *
 *   pnpm archive:2022 [group]
 */

import { buildFleetSeries, type DayFleetSpec } from '../lib/halsail/to-series';
import { archiveBuilder, type Group } from '../lib/halsail/archive-build';

const { frag, tandemFrags, runMain } = archiveBuilder('2022');

const echo = (id: string, name: string, cls: string, d: string): DayFleetSpec =>
  ({ fleetId: id, name, system: 'echo', fragment: frag(cls, `${d} Overall`), tandemFragments: tandemFrags(cls, d) });
const irc = (id: string, name: string, cls: string, d: string): DayFleetSpec =>
  ({ fleetId: id, name, system: 'irc', fragment: frag(cls, `${d} Overall`), tandemFragments: tandemFrags(cls, d) });
const scratch = (id: string, name: string, cls: string, d: string): DayFleetSpec =>
  ({ fleetId: id, name, system: 'scratch', fragment: frag(cls, `${d} Overall`), tandemFragments: tandemFrags(cls, d) });

function cruiserFleets(d: string, suf: string): DayFleetSpec[] {
  const fleets: DayFleetSpec[] = [];
  for (const n of [0, 1, 2, 3]) {
    fleets.push(echo(`cf-${n}-echo`, `Cruisers ${n} ECHO`, `Cruisers ${n} Echo (${suf})`, d));
    fleets.push(irc(`cf-${n}-irc`, `Cruisers ${n} IRC`, `Cruisers ${n} IRC`, d));
  }
  fleets.push(scratch('cf-j109', 'J/109', 'Cruisers 1 - J109', d));
  fleets.push(scratch('cf-sigma33', 'Sigma 33', 'Cruisers 2 - Sigma33', d));
  fleets.push(echo('cf-45a-echo', 'Cruisers 4 (+5A) ECHO', `Cruisers 4 (+5A) Echo (${suf})`, d));
  fleets.push(irc('cf-45a-irc', 'Cruisers 4 (+5A) IRC', 'Cruisers 4 (+5A) NS IRC', d));
  if (d === 'Thursday') {
    fleets.push(echo('cf-5a-echo', 'Cruisers 5A ECHO', 'Cruisers 5A Echo', d));
    fleets.push(irc('cf-5a-irc', 'Cruisers 5A IRC', 'Cruisers 5A NS IRC', d));
    fleets.push(echo('cf-5b-echo', 'Cruisers 5B ECHO', 'Cruisers 5B Echo', d));
  } else {
    fleets.push(echo('cf-5-echo', 'Cruisers 5 ECHO', 'Cruisers 5 (A+B) Echo', d));
    fleets.push(irc('cf-5-irc', 'Cruisers 5 IRC', 'Cruisers 5 (A+B) NS IRC', d));
  }
  return fleets;
}

const cruiserOverride: Record<string, string> = {
  'Cruisers 4 (+5A) ECHO': 'Cruisers 4 (+5A) Echo (Thu)', // refined per group below
  'Cruisers 4 (+5A) IRC': 'Cruisers 4 (+5A) NS IRC',
  'Cruisers 5A ECHO': 'Cruisers 5A Echo', 'Cruisers 5A IRC': 'Cruisers 5A NS IRC', 'Cruisers 5B ECHO': 'Cruisers 5B Echo',
  'Cruisers 5 ECHO': 'Cruisers 5 (A+B) Echo', 'Cruisers 5 IRC': 'Cruisers 5 (A+B) NS IRC',
  'J/109': 'Cruisers 1 - J109', 'Sigma 33': 'Cruisers 2 - Sigma33',
};

const THURSDAY_CRUISERS: Group = {
  out: 'dbsc-2022-thursday-cruisers', name: 'DBSC 2022 — Thursday Cruisers',
  day: 'Thursday', echoSuffix: 'Thu', classNames: [],
  fleetClassOverride: { ...cruiserOverride, 'Cruisers 4 (+5A) ECHO': 'Cruisers 4 (+5A) Echo (Thu)' },
  build: (opts) => buildFleetSeries(cruiserFleets('Thursday', 'Thu'), opts),
};

const SATURDAY_CRUISERS: Group = {
  out: 'dbsc-2022-saturday-cruisers', name: 'DBSC 2022 — Saturday Cruisers',
  day: 'Saturday', echoSuffix: 'Sat', classNames: [],
  fleetClassOverride: { ...cruiserOverride, 'Cruisers 4 (+5A) ECHO': 'Cruisers 4 (+5A) Echo (Sat)' },
  build: (opts) => buildFleetSeries(cruiserFleets('Saturday', 'Sat'), opts),
};

function odFleets(d: string, extra: DayFleetSpec[]): DayFleetSpec[] {
  return [
    scratch('fl-dragon', 'Dragon', 'Dragon', d),
    scratch('fl-ff', 'Flying Fifteen', 'Flying Fifteen', d),
    scratch('fl-ruffian', 'Ruffian 23', 'Ruffian 23', d),
    scratch('fl-sb20', 'SB20', 'SB20', d),
    scratch('fl-shipman', 'Shipman', 'Shipman', d),
    { fleetId: 'fl-sportsboats', name: 'Mixed Sportsboats', system: 'vprs', fragment: frag('Sportsboats', `${d} Overall`), tandemFragments: tandemFrags('Sportsboats', d) },
    scratch('fl-glen', 'Glen', 'Glen', d),
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
  out: 'dbsc-2022-thursday-od', name: 'DBSC 2022 — Thursday One-designs & Sportsboats',
  day: 'Thursday', echoSuffix: 'Thu', classNames: [], fleetClassOverride: odOverride,
  build: (opts) => buildFleetSeries(odFleets('Thursday', []), opts),
};

const SATURDAY_OD: Group = {
  out: 'dbsc-2022-saturday-od', name: 'DBSC 2022 — Saturday One-designs, Sportsboats & PY',
  day: 'Saturday', echoSuffix: 'Sat', classNames: [],
  fleetClassOverride: { ...odOverride, 'Beneteau 211 ECHO': 'Beneteau 211 Echo (Sat)', 'Beneteau 31.7 ECHO': 'Beneteau 31.7 Echo (Sat)' },
  build: (opts) => buildFleetSeries(odFleets('Saturday', [
    scratch('fl-db21', 'Dublin Bay 21', 'Dublin Bay 21', 'Saturday'),
    scratch('fl-fireball', 'Fireball', 'Fireball', 'Saturday'),
    scratch('fl-idra14', 'IDRA 14', 'IDRA 14', 'Saturday'),
    scratch('fl-laser-rad', 'Laser Radial', 'Laser Radial', 'Saturday'),
    scratch('fl-squib-mermaid', 'Squib-Mermaid', 'Squib-Mermaid', 'Saturday'),
    { fleetId: 'fl-pyclass', name: 'PY Class', system: 'py', fragment: frag('PY Class', 'Saturday Overall'), tandemFragments: tandemFrags('PY Class', 'Saturday') },
  ]), opts),
};

const WATER_WAGS: Group = {
  out: 'dbsc-2022-water-wags', name: 'DBSC 2022 — Water Wags',
  day: 'Wednesday', echoSuffix: '', classNames: ['Water Wag'], fleetClassOverride: {},
  blockNames: ['Series A', 'Series B', 'Series C'],
  build: (opts) => buildFleetSeries(
    [{ fleetId: 'fl-waterwag', name: 'Water Wag', system: 'scratch', fragment: frag('Water Wag', 'Wednesday Overall'), tandemFragments: tandemFrags('Water Wag', 'Wednesday', ['Series A', 'Series B', 'Series C']) }],
    opts,
  ),
};

const TUESDAY_OD: Group = {
  out: 'dbsc-2022-tuesday-od', name: 'DBSC 2022 — Tuesday One-designs, Sportsboats & PY',
  day: 'Tuesday', echoSuffix: 'Tue', classNames: [],
  subSeriesNames: ['Tuesday Overall', 'Tuesday Series A', 'Tuesday Series B', 'Tuesday Series C'],
  fleetClassOverride: { 'Mixed Sportsboats': 'Sportsboats', 'Beneteau 211 ECHO': 'Beneteau 211 Echo (Tue)' },
  build: (opts) => {
    const t = (cn: string) => tandemFrags(cn, 'Tuesday', ['Series A', 'Series B', 'Series C']);
    const tf = (id: string, name: string, cls: string, sys: DayFleetSpec['system'] = 'scratch'): DayFleetSpec =>
      ({ fleetId: id, name, system: sys, fragment: frag(cls, 'Tuesday Overall'), tandemFragments: t(cls) });
    return buildFleetSeries([
      tf('fl-fireball', 'Fireball', 'Fireball'),
      tf('fl-idra14', 'IDRA 14', 'IDRA 14'),
      tf('fl-laser-std', 'Laser Standard', 'Laser Standard'),
      tf('fl-laser-rad', 'Laser Radial', 'Laser Radial'),
      tf('fl-pyclass', 'PY Class', 'PY Class', 'py'),
      { fleetId: 'fl-ff', name: 'Flying Fifteen', system: 'scratch', fragment: frag('Flying Fifteen', 'Tuesday Overall') },
      { fleetId: 'fl-glen', name: 'Glen', system: 'scratch', fragment: frag('Glen', 'Tuesday Overall') },
      { fleetId: 'fl-ruffian', name: 'Ruffian 23', system: 'scratch', fragment: frag('Ruffian 23', 'Tuesday Overall') },
      { fleetId: 'fl-sportsboats', name: 'Mixed Sportsboats', system: 'vprs', fragment: frag('Sportsboats', 'Tuesday Overall') },
      { fleetId: 'fl-b211-echo', name: 'Beneteau 211 ECHO', system: 'echo', fragment: frag('Beneteau 211 Echo (Tue)', 'Tuesday Overall') },
    ] satisfies DayFleetSpec[], opts);
  },
};

const TUESDAY_CRUISERS: Group = {
  out: 'dbsc-2022-tuesday-cruisers', name: 'DBSC 2022 — Tuesday Cruisers',
  day: 'Tuesday', echoSuffix: 'Tue', classNames: [],
  subSeriesNames: ['Tuesday Overall'],
  fleetClassOverride: { 'Combined Cruisers': 'Combined Cruisers (Tue)' },
  build: (opts) => buildFleetSeries([
    { fleetId: 'cf-combined', name: 'Combined Cruisers', system: 'echo', fragment: frag('Combined Cruisers (Tue)', 'Tuesday Overall') },
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
