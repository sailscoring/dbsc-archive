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
/** Dates of a (class, series) fragment, or [] if absent. */
function fragDates(className: string, seriesName: string): string[] {
  const key = seriesKey(className, seriesName);
  if (!key) return [];
  const f = parseHalsailFleet(readFileSync(join(RESULTS, `series-${key}.html`), 'utf8'));
  return f.races.map((r) => r.date).filter((d): d is string => !!d);
}

const DBSC_DISCARDS: DiscardThreshold[] = [
  { minRaces: 4, discardCount: 1 }, { minRaces: 7, discardCount: 2 },
  { minRaces: 12, discardCount: 3 }, { minRaces: 18, discardCount: 4 },
  { minRaces: 25, discardCount: 5 }, { minRaces: 32, discardCount: 6 },
];

/** Build Overall/A/B sub-series for a day-group: Overall = all races; A/B select
 *  by the date union of each member class's "Series A"/"Series B" fragment.
 *  Series B `continue`s the progressive (ECHO) chain from Series A — HalSail
 *  scores a tandem over the shared chain, so the late block resumes mid-chain
 *  rather than re-seeding from base. */
function buildSubSeries(file: SeriesFile, day: string, classNames: string[]): SubSeries[] {
  const aDates = new Set(classNames.flatMap((c) => fragDates(c, `${day} Series A`)));
  const bDates = new Set(classNames.flatMap((c) => fragDates(c, `${day} Series B`)));
  const ids = (pred: (date: string) => boolean) =>
    file.races.filter((r) => pred(r.date)).map((r) => r.id);
  const list: SubSeries[] = [
    { id: 'ss-overall', seriesId: file.seriesId, name: `${day} Overall`, displayOrder: 0, raceIds: file.races.map((r) => r.id), startingHandicapSource: 'base' },
  ];
  if (aDates.size) list.push({ id: 'ss-a', seriesId: file.seriesId, name: `${day} Series A`, displayOrder: 1, raceIds: ids((d) => aDates.has(d)), startingHandicapSource: 'base' });
  if (bDates.size) list.push({ id: 'ss-b', seriesId: file.seriesId, name: `${day} Series B`, displayOrder: 2, raceIds: ids((d) => bDates.has(d)), startingHandicapSource: list.some((s) => s.id === 'ss-a') ? 'continue' : 'base', continueFromSubSeriesId: list.some((s) => s.id === 'ss-a') ? 'ss-a' : null });
  return list;
}

function attachSubSeries(file: SeriesFile, subs: SubSeries[]): unknown {
  return { ...file, formatVersion: 9, subSeries: subs };
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
    const seriesName = block.subSeries.name.replace(`${day} `, '');     // "Overall"/"Series A"/"Series B"
    for (const fs of block.fleetStandings) {
      const className = fleetClassOverride[fs.fleet.name] ?? classNameForFleet(fs.fleet.name, echoSuffix);
      const pub = publishedNet(className, `${day} ${seriesName}`);
      if (!pub) { console.log(`    ?  ${block.subSeries.name} / ${fs.fleet.name}: no published "${className}/${day} ${seriesName}"`); continue; }
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
      { classNum: 3, echo: frag('Cruisers 3 Echo (Thu)', 'Thursday Overall'), irc: frag('Cruisers 3 IRC', 'Thursday Overall') },
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

const GROUPS: Record<string, Group> = {
  'thursday-cruisers': THURSDAY_CRUISERS,
  'thursday-od': THURSDAY_OD,
};

function run(key: string, group: Group, doValidate: boolean): boolean {
  const base = group.build({ seriesName: group.name, seriesId: group.out, exportedAt: '2025-09-01T00:00:00.000Z' });
  const subs = buildSubSeries(base, group.day, group.classNames);
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
