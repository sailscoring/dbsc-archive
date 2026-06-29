/**
 * Build the 2025 DBSC season from the archive as Sail Scoring `.sailscoring`
 * files — one per finish-sheet day-group, each carrying the HalSail tandem
 * series (Overall / Series A / Series B) as sub-series. Phase-2 of
 * docs/design/dbsc-parity-plan.md (in the app repo).
 *
 * Reuses the parity-proven 2026 builders (buildCruiserDaySeries etc.) on the
 * archive fragments, which parse-results.ts now reads (M1). Fragments are
 * resolved by class + series name via sources/2025/catalog.json, so we never
 * hand-transcribe the dataset-local series keys.
 *
 *   pnpm archive:2025            # build every group
 *   pnpm archive:2025 thursday   # one group
 *   pnpm archive:2025 --no-validate
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { parseHalsailFleet, type HalsailFleet } from '../lib/halsail/parse-results';
import {
  buildCruiserDaySeries, buildCombinedCruisersSeries, buildFleetSeries,
  type BuildOptions, type DayFleetSpec, type SeriesFile,
} from '../lib/halsail/to-series';
import { calculateSubSeriesFleetStandings } from '../../sailscoring/lib/scoring';
import type {
  Competitor, DiscardThreshold, Fleet, Finish, Race, RaceStart, Standing, SubSeries,
  SubSeriesRaceExclusion,
} from '../../sailscoring/lib/types';

const SRC = join(__dirname, '..', 'sources', '2025');
const RESULTS = join(SRC, 'results');
const OUT_DIR = join(SRC, 'reconstructed');

const catalog = JSON.parse(readFileSync(join(SRC, 'catalog.json'), 'utf8')) as {
  classes: { key: string; name: string; series: { key: string; name: string }[] }[];
};

/** Resolve the fragment for a (class, series-name) pair via the catalog. */
function seriesKey(className: string, seriesName: string): string | null {
  const cl = catalog.classes.find((c) => c.name === className);
  const s = cl?.series.find((x) => x.name === seriesName);
  return s?.key ?? null;
}
function frag(className: string, seriesName: string): HalsailFleet {
  const key = seriesKey(className, seriesName);
  if (!key) throw new Error(`no fragment for "${className}" / "${seriesName}"`);
  return parseHalsailFleet(readFileSync(join(RESULTS, `series-${key}.html`), 'utf8'));
}
/** The Series A/B tandem fragments that exist for a (class, day) — for feeding
 *  tandem-only races (a heat in a tandem the class's Overall omits) into the
 *  builder. Skips tandems with no published fragment. */
function tandemFrags(className: string, prefix: string, blocks: string[] = ['Series A', 'Series B']): HalsailFleet[] {
  return blocks
    .filter((s) => seriesKey(className, `${prefix} ${s}`))
    .map((s) => frag(className, `${prefix} ${s}`));
}

/** `date#startTime` keys of a (class, series) fragment's races, or [] if absent.
 *  The start time identifies the physical race a class actually sailed — robust
 *  where date alone is not (two races a day, classes with different A/B
 *  boundaries, a class sailing only one of a day's races). */
function fragStartKeys(className: string, seriesName: string): string[] {
  const key = seriesKey(className, seriesName);
  if (!key) return [];
  const f = parseHalsailFleet(readFileSync(join(RESULTS, `series-${key}.html`), 'utf8'));
  return f.races
    .filter((r) => r.date && r.startTime)
    .map((r) => `${r.date}#${r.startTime}`);
}

const DBSC_DISCARDS: DiscardThreshold[] = [
  { minRaces: 4, discardCount: 1 }, { minRaces: 7, discardCount: 2 },
  { minRaces: 12, discardCount: 3 }, { minRaces: 18, discardCount: 4 },
  { minRaces: 25, discardCount: 5 }, { minRaces: 32, discardCount: 6 },
];

/** Build Overall/A/B sub-series for a day-group: Overall = all races; A/B select
 *  the physical races each member class sailed in its "Series A"/"Series B"
 *  tandem, matched by (date, start-time) against the merged file. Matching on the
 *  start a class actually sailed — not the date — is what makes this correct when
 *  a day holds two races and classes keep different A/B boundaries.
 *
 *  A tandem's `raceIds` is the *union* of the races its member classes sailed in
 *  that tandem, so the merged race list covers every class. But a fleet is scored
 *  on every race it has a *start* in, so a shared start that one class put in
 *  Series A and another in Series B lands in both unions — and each fleet would
 *  wrongly be scored on it in the tandem it didn't assign it to. So each tandem
 *  also carries **per-fleet race exclusions** (#203): for fleet F, strike the
 *  union races F actually sailed but did **not** include in its own F-tandem
 *  fragment. This reproduces HalSail's per-class tandem race membership exactly —
 *  the Q4 divergent A/B boundaries and the Q1/Q5 single-competitor "flicks"
 *  (including DBSC's manual misses, since we read each fleet's real fragment).
 *
 *  Series B `continue`s the progressive (ECHO) chain from Series A — HalSail
 *  scores a tandem over the shared chain, so the late block resumes mid-chain
 *  rather than re-seeding from base. */
/** The catalog series names a class publishes (its tandems). */
function classSeriesNames(className: string): string[] {
  return catalog.classes.find((c) => c.name === className)?.series.map((s) => s.name) ?? [];
}

function buildSubSeries(file: SeriesFile, group: Group): SubSeries[] {
  const { day, fleetClassOverride, echoSuffix } = group;
  const fleetClassName = (fleet: { id: string; name: string }) => fleetClassOverride[fleet.name] ?? classNameForFleet(fleet.name, echoSuffix);
  // date#startTime → race id, for every per-class start in the merged file.
  const keyToRace = new Map<string, string>();
  for (const r of file.races) {
    for (const s of r.starts) keyToRace.set(`${r.date}#${s.startTime}`, r.id);
  }
  // race id → fleet ids that would be scored there: any fleet with a start, plus
  // any fleet that has a competitor finishing the race (a boat can finish a heat
  // via a start it shares — e.g. a Cruisers 3 IRC boat in the Cruisers 3 ECHO
  // start — so a finish, not just a start, makes the heat count for the fleet).
  const fleetsByComp = new Map<string, string[]>(file.competitors.map((c) => [c.id, c.fleetIds]));
  const scoredFleetsByRace = new Map<string, Set<string>>();
  for (const r of file.races) {
    const set = new Set<string>();
    for (const s of r.starts) for (const fid of s.fleetIds) set.add(fid);
    for (const fi of r.finishes) for (const fid of fleetsByComp.get(fi.competitorId ?? '') ?? []) set.add(fid);
    scoredFleetsByRace.set(r.id, set);
  }
  // The races a fleet included in a published series, by its own class fragment.
  const fleetTandemRaceIds = (fleet: { id: string; name: string }, seriesName: string): Set<string> => {
    const ids = new Set<string>();
    for (const k of fragStartKeys(fleetClassName(fleet), seriesName)) {
      const id = keyToRace.get(k);
      if (id) ids.add(id);
    }
    return ids;
  };

  // A sub-series is one published series name (e.g. "Thursday Series A", "2025
  // Summer Series"), scoped to the fleets that publish it. Its race set is the
  // union of those fleets' tandem heats; per-fleet exclusions then strike, from
  // each scoped fleet, a union heat it was scored in but did not include in its
  // own tandem (per-class membership — CLARIFICATIONS Q1/Q2/Q4/Q5).
  const overallName = group.overallName ?? 'Overall';
  const blockNames = group.blockNames ?? ['Series A', 'Series B'];
  const entries: (string | { name: string; fleetIds: string[] })[] =
    group.subSeriesNames ?? [`${day} ${overallName}`, ...blockNames.map((b) => `${day} ${b}`)];

  const nameToId = new Map<string, string>();
  const list: SubSeries[] = [];
  entries.forEach((entry, i) => {
    const name = typeof entry === 'string' ? entry : entry.name;
    const pinned = typeof entry === 'string' ? null : new Set(entry.fleetIds);
    const scope = file.fleets.filter((f) =>
      pinned ? pinned.has(f.id) : classSeriesNames(fleetClassName(f)).includes(name));
    if (!scope.length) return; // no fleet in this group publishes this series
    const classNames = [...new Set(scope.map(fleetClassName))];
    const keys = new Set(classNames.flatMap((cn) => fragStartKeys(cn, name)));
    const raceIds = file.races.filter((r) => [...keys].some((k) => keyToRace.get(k) === r.id)).map((r) => r.id);
    const exclusions: SubSeriesRaceExclusion[] = [];
    for (const fleet of scope) {
      const own = fleetTandemRaceIds(fleet, name);
      for (const raceId of raceIds) {
        if (own.has(raceId)) continue;
        if (scoredFleetsByRace.get(raceId)?.has(fleet.id)) exclusions.push({ raceId, fleetId: fleet.id });
      }
    }
    // Chain a "… Series B/C/…" block onto the previous letter's sub-series, so a
    // progressive (ECHO) tandem resumes mid-chain rather than re-seeding.
    const m = name.match(/^(.*Series) ([B-Z])$/);
    const prevName = m ? `${m[1]} ${String.fromCharCode(m[2].charCodeAt(0) - 1)}` : null;
    const continueFrom = prevName ? nameToId.get(prevName) ?? null : null;
    const id = `ss-${i}`;
    nameToId.set(name, id);
    list.push({
      id, seriesId: file.seriesId, name, displayOrder: i,
      raceIds,
      ...(exclusions.length ? { raceFleetExclusions: exclusions } : {}),
      ...(scope.length < file.fleets.length ? { fleetIds: scope.map((f) => f.id) } : {}),
      startingHandicapSource: continueFrom ? 'continue' : 'base',
      continueFromSubSeriesId: continueFrom,
    });
  });
  return list;
}

function attachSubSeries(file: SeriesFile, subs: SubSeries[]): unknown {
  return { ...file, formatVersion: 11, subSeries: subs };
}

// ---- validation: each (sub-series × fleet) Net vs the published summary ----

const normSail = (s: string) => s.toUpperCase().replace(/\s+/g, '');

/** Published Net by sail from a (class, series) summary fragment. */
function publishedNet(className: string, seriesName: string): Map<string, number> | null {
  const key = seriesKey(className, seriesName);
  if (!key) return null;
  const html = readFileSync(join(RESULTS, `series-${key}.html`), 'utf8');
  const summ = (html.match(/<table\b[^>]*>[\s\S]*?<\/table>/gi) ?? [])
    .find((t) => /<th\b[^>]*>\s*Rank/i.test(t));
  if (!summ) return null;
  const heads = (summ.match(/<th\b[^>]*>([\s\S]*?)<\/th>/gi) ?? [])
    .map((h) => h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim().toLowerCase());
  const iSail = heads.findIndex((h) => h.includes('sail'));
  const out = new Map<string, number>();
  for (const tr of summ.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? []) {
    if (!/<td\b/i.test(tr)) continue;
    const cells = (tr.match(/<td\b[^>]*>([\s\S]*?)<\/td>/gi) ?? [])
      .map((td) => td.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim());
    if (cells.length !== heads.length) continue;
    const sail = cells[iSail];
    if (!sail || !/\d/.test(sail)) continue;
    const net = Number(cells[cells.length - 1]);
    if (Number.isFinite(net)) out.set(normSail(sail), net);
  }
  return out;
}

/** Map our fleet name → the catalog class name carrying its published summary. */
function classNameForFleet(fleetName: string, echoSuffix: string): string {
  const m = fleetName.match(/^Cruisers (\d) ECHO$/);
  if (m) return `Cruisers ${m[1]} Echo (${echoSuffix})`;
  return fleetName;
}

function validate(fileObj: any, subs: SubSeries[], day: string, echoSuffix: string, fleetClassOverride: Record<string, string>): boolean {
  const competitors = fileObj.competitors as Competitor[];
  const fleets = fileObj.fleets as Fleet[];
  const races: Race[] = fileObj.races.map((r: any) => ({ id: r.id, raceNumber: r.raceNumber, date: r.date }) as Race);
  const finishes: Finish[] = fileObj.races.flatMap((r: any) => r.finishes.map((f: any) => ({ ...f, raceId: r.id }) as Finish));
  const starts: RaceStart[] = fileObj.races.flatMap((r: any) => r.starts.map((s: any) => ({ ...s, raceId: r.id }) as RaceStart));
  const overrides = fileObj.races.flatMap((r: any) => (r.ratingOverrides ?? []).map((o: any) => ({ ...o, raceId: r.id })));

  const result = calculateSubSeriesFleetStandings(
    subs, fleets, competitors, races, finishes, DBSC_DISCARDS, fileObj.series.dnfScoring, starts, overrides,
  );
  let allOk = true;
  for (const block of result) {
    const seriesName = block.subSeries.name;     // the published series name, e.g. "Thursday Series A" / "2025 Series C"
    for (const fs of block.fleetStandings) {
      const className = fleetClassOverride[fs.fleet.name] ?? classNameForFleet(fs.fleet.name, echoSuffix);
      const pub = publishedNet(className, seriesName);
      if (!pub) { console.log(`    ?  ${block.subSeries.name} / ${fs.fleet.name}: no published "${className}/${seriesName}"`); continue; }
      const ours = new Map((fs.standings as Standing[]).map((s) => [normSail(s.competitor.sailNumber), s.netPoints]));
      let diffs = 0;
      for (const [sail, net] of pub) {
        const o = ours.get(sail);
        if (o == null || Math.abs(o - net) > 0.05) { diffs++; if (diffs <= 2) console.log(`       ✗ ${fs.fleet.name} ${sail}: ours=${o} pub=${net}`); }
      }
      console.log(`    ${diffs === 0 ? 'OK  ' : 'FAIL'} ${block.subSeries.name} / ${fs.fleet.name}: ${pub.size} boats${diffs ? `, ${diffs} diffs` : ''}`);
      if (diffs) allOk = false;
    }
  }
  return allOk;
}

// ---- day-group configs ----

interface Group {
  out: string;
  name: string;
  day: string;            // sub-series prefix + echo-fragment suffix (Thu/Sat/Tue)
  echoSuffix: string;
  classNames: string[];   // member catalog classes (for sub-series date union)
  fleetClassOverride: Record<string, string>;  // our-fleet-name → catalog class
  overallName?: string;   // the "Overall" tandem's name (default); Wags use "Summer Series"
  blockNames?: string[];  // race-subset tandems (default Series A/B); Tuesday/Wags add Series C
  // Explicit published series names to build as sub-series. Each auto-scopes to
  // the fleets that publish it, unless an entry pins `fleetIds` — needed where a
  // name is ambiguous: most classes also publish a whole-season "2025 Summer
  // Series" that spans more than this day, so the Tuesday women's combine pins
  // its scope to just that fleet. Overrides day/overallName/blockNames.
  subSeriesNames?: (string | { name: string; fleetIds: string[] })[];
  build: (opts: BuildOptions) => SeriesFile;
}

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

function run(key: string, group: Group, doValidate: boolean): boolean {
  const base = group.build({ seriesName: group.name, seriesId: group.out, exportedAt: '2025-09-01T00:00:00.000Z' });
  const subs = buildSubSeries(base, group);
  const fileObj = attachSubSeries(base, subs) as any;
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, `${group.out}.sailscoring`), JSON.stringify(fileObj, null, 2) + '\n');
  console.log(`\n=== ${group.name} ===`);
  console.log(`  ${fileObj.fleets.length} fleets, ${fileObj.competitors.length} boats, ${fileObj.races.length} races, ${subs.length} sub-series`);
  if (!doValidate) return true;
  return validate(fileObj, subs, group.day, group.echoSuffix, group.fleetClassOverride);
}

function main() {
  const args = process.argv.slice(2);
  const doValidate = !args.includes('--no-validate');
  const only = args.find((a) => !a.startsWith('--'));
  const keys = only ? [only] : Object.keys(GROUPS);
  let ok = true;
  for (const k of keys) {
    const g = GROUPS[k];
    if (!g) { console.error(`unknown group "${k}". Have: ${Object.keys(GROUPS).join(', ')}`); process.exit(1); }
    if (!run(k, g, doValidate)) ok = false;
  }
  console.log(`\n${ok ? 'All validated groups parity-green.' : 'Some fleets diverged (see FAIL above).'}`);
  process.exit(ok ? 0 : 1);
}

main();
