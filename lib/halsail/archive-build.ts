/**
 * Shared machinery for reconstructing a DBSC archive season into Sail Scoring
 * `.sailscoring` files — one per finish-sheet day-group, each carrying the
 * HalSail tandem series as sub-series. Phase-2 of docs/design/dbsc-parity-plan.md.
 *
 * Per-year scripts (`scripts/halsail-archive-<year>.ts`) define that season's
 * day-groups and call `runMain`; everything year-agnostic lives here, bound to a
 * year's `sources/<year>/` catalog + result fragments by `archiveBuilder(year)`.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { parseHalsailFleet, type HalsailFleet } from './parse-results';
import type { BuildOptions, SeriesFile } from './to-series';
import { calculateSubSeriesFleetStandings } from '../../../sailscoring/lib/scoring';
import type {
  Competitor, DiscardThreshold, Fleet, Finish, Race, RaceStart, Standing, SubSeries,
  SubSeriesRaceExclusion,
} from '../../../sailscoring/lib/types';

/** A finish-sheet day-group: a set of fleets built into one `.sailscoring`, plus
 *  how its HalSail tandems map onto sub-series. */
export interface Group {
  out: string;
  name: string;
  day: string;            // sub-series prefix + echo-fragment suffix (Thu/Sat/Tue)
  echoSuffix: string;
  classNames: string[];   // member catalog classes (legacy; unused by auto-scoped sub-series)
  fleetClassOverride: Record<string, string>;  // our-fleet-name → catalog class
  overallName?: string;   // the "Overall" tandem's name (default); Wags use "Summer Series"
  blockNames?: string[];  // race-subset tandems (default Series A/B); Tuesday/Wags add Series C
  // Explicit published series names to build as sub-series. Each auto-scopes to
  // the fleets that publish it, unless an entry pins `fleetIds`. Overrides
  // day/overallName/blockNames.
  subSeriesNames?: (string | { name: string; fleetIds: string[] })[];
  build: (opts: BuildOptions) => SeriesFile;
}

/** DBSC sliding discard ladder (SI A13.4). */
export const DBSC_DISCARDS: DiscardThreshold[] = [
  { minRaces: 4, discardCount: 1 }, { minRaces: 7, discardCount: 2 },
  { minRaces: 12, discardCount: 3 }, { minRaces: 18, discardCount: 4 },
  { minRaces: 25, discardCount: 5 }, { minRaces: 32, discardCount: 6 },
];

/** Map our fleet name → the catalog class name carrying its published summary. */
export function classNameForFleet(fleetName: string, echoSuffix: string): string {
  const m = fleetName.match(/^Cruisers (\d) ECHO$/);
  if (m) return `Cruisers ${m[1]} Echo (${echoSuffix})`;
  return fleetName;
}

const normSail = (s: string) => s.toUpperCase().replace(/\s+/g, '');

/** Whether a sub-series should drop all-DNC competitors, by DBSC's *intent* (not
 *  their per-class HalSail config, which carries manual mistakes). The published
 *  rosters show a clear migration: 2022 listed the full entry list everywhere
 *  (include); one-design blocks began ranking only participants in 2023; by
 *  2024–25 every block excludes non-starters while the season "Overall" still
 *  lists the entry list. Modelling the intent per sub-series (not per class)
 *  stops a future scorer reproducing those manual slips. */
function excludeDncIntent(year: string, group: Group, subSeriesName: string): boolean {
  const isBlock = /Series [A-Z]$/.test(subSeriesName);
  const oneDesign = !group.out.endsWith('-cruisers');
  if (year === '2022') return false;             // full entry list everywhere
  if (year === '2023') return isBlock && oneDesign; // one-design blocks switch first
  return isBlock;                                // 2024+: blocks exclude, Overall includes
}

/** Bind the reconstruction machinery to one season's catalog + fragments. */
export function archiveBuilder(year: string) {
  const SRC = join(__dirname, '..', '..', 'sources', year);
  const RESULTS = join(SRC, 'results');
  const OUT_DIR = join(SRC, 'reconstructed');
  const catalog = JSON.parse(readFileSync(join(SRC, 'catalog.json'), 'utf8')) as {
    classes: { key: string; name: string; series: { key: string; name: string }[] }[];
  };

  /** Resolve the fragment key for a (class, series-name) pair via the catalog. */
  const seriesKey = (className: string, seriesName: string): string | null =>
    catalog.classes.find((c) => c.name === className)?.series.find((x) => x.name === seriesName)?.key ?? null;

  const frag = (className: string, seriesName: string): HalsailFleet => {
    const key = seriesKey(className, seriesName);
    if (!key) throw new Error(`no fragment for "${className}" / "${seriesName}" (${year})`);
    return parseHalsailFleet(readFileSync(join(RESULTS, `series-${key}.html`), 'utf8'));
  };

  /** The Series A/B[/C] tandem fragments that exist for a (class, prefix) — feeds
   *  tandem-only races (a heat in a tandem the Overall omits) into the builder. */
  const tandemFrags = (className: string, prefix: string, blocks: string[] = ['Series A', 'Series B']): HalsailFleet[] =>
    blocks.filter((s) => seriesKey(className, `${prefix} ${s}`)).map((s) => frag(className, `${prefix} ${s}`));

  /** `date#startTime` keys of a (class, series) fragment's races, or [] if absent. */
  const fragStartKeys = (className: string, seriesName: string): string[] => {
    const key = seriesKey(className, seriesName);
    if (!key) return [];
    return parseHalsailFleet(readFileSync(join(RESULTS, `series-${key}.html`), 'utf8')).races
      .filter((r) => r.date && r.startTime).map((r) => `${r.date}#${r.startTime}`);
  };

  const classSeriesNames = (className: string): string[] =>
    catalog.classes.find((c) => c.name === className)?.series.map((s) => s.name) ?? [];

  function buildSubSeries(file: SeriesFile, group: Group): SubSeries[] {
    const { day, fleetClassOverride, echoSuffix } = group;
    const fleetClassName = (fleet: { id: string; name: string }) =>
      fleetClassOverride[fleet.name] ?? classNameForFleet(fleet.name, echoSuffix);
    const keyToRace = new Map<string, string>();
    for (const r of file.races) for (const s of r.starts) keyToRace.set(`${r.date}#${s.startTime}`, r.id);
    // race id → fleet ids that would be scored there: any fleet with a start, plus
    // any fleet with a finishing competitor (a boat can reach a heat via a shared
    // start — e.g. a Cruisers 3 IRC boat in the Cruisers 3 ECHO start).
    const fleetsByComp = new Map<string, string[]>(file.competitors.map((c) => [c.id, c.fleetIds]));
    const scoredFleetsByRace = new Map<string, Set<string>>();
    for (const r of file.races) {
      const set = new Set<string>();
      for (const s of r.starts) for (const fid of s.fleetIds) set.add(fid);
      for (const fi of r.finishes) for (const fid of fleetsByComp.get(fi.competitorId ?? '') ?? []) set.add(fid);
      scoredFleetsByRace.set(r.id, set);
    }
    const fleetTandemRaceIds = (fleet: { id: string; name: string }, seriesName: string): Set<string> => {
      const ids = new Set<string>();
      for (const k of fragStartKeys(fleetClassName(fleet), seriesName)) {
        const id = keyToRace.get(k);
        if (id) ids.add(id);
      }
      return ids;
    };

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
      if (!scope.length) return;
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
        excludeDncOnlyCompetitors: excludeDncIntent(year, group, name),
      });
    });
    return list;
  }

  /** Published Net by sail from a (class, series) summary fragment. */
  function publishedNet(className: string, seriesName: string): Map<string, number> | null {
    const key = seriesKey(className, seriesName);
    if (!key) return null;
    const html = readFileSync(join(RESULTS, `series-${key}.html`), 'utf8');
    const summ = (html.match(/<table\b[^>]*>[\s\S]*?<\/table>/gi) ?? []).find((t) => /<th\b[^>]*>\s*Rank/i.test(t));
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

  function validate(fileObj: any, subs: SubSeries[], group: Group): boolean {
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
      const seriesName = block.subSeries.name;
      for (const fs of block.fleetStandings) {
        const className = group.fleetClassOverride[fs.fleet.name] ?? classNameForFleet(fs.fleet.name, group.echoSuffix);
        const pub = publishedNet(className, seriesName);
        if (!pub) { console.log(`    ?  ${block.subSeries.name} / ${fs.fleet.name}: no published "${className}/${seriesName}"`); continue; }
        const ours = new Map((fs.standings as Standing[]).map((s) => [normSail(s.competitor.sailNumber), s.netPoints]));
        let diffs = 0;
        for (const [sail, net] of pub) {
          const o = ours.get(sail);
          if (o == null || Math.abs(o - net) > 0.05) { diffs++; if (diffs <= 2) console.log(`       ✗ ${fs.fleet.name} ${sail}: ours=${o} pub=${net}`); }
        }
        // Boats in our standings the published table doesn't list — e.g. an
        // all-DNC boat we scored that HalSail excluded from this tandem.
        for (const sail of ours.keys()) {
          if (!pub.has(sail)) { diffs++; if (diffs <= 2) console.log(`       ✗ ${fs.fleet.name} ${sail}: ours=${ours.get(sail)} pub=(absent)`); }
        }
        console.log(`    ${diffs === 0 ? 'OK  ' : 'FAIL'} ${block.subSeries.name} / ${fs.fleet.name}: ${pub.size} boats${diffs ? `, ${diffs} diffs` : ''}`);
        if (diffs) allOk = false;
      }
    }
    return allOk;
  }

  function run(group: Group, doValidate: boolean): boolean {
    const base = group.build({ seriesName: group.name, seriesId: group.out, exportedAt: `${year}-09-01T00:00:00.000Z` });
    const subs = buildSubSeries(base, group);
    const fileObj = attachSubSeries(base, subs) as any;
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(join(OUT_DIR, `${group.out}.sailscoring`), JSON.stringify(fileObj, null, 2) + '\n');
    console.log(`\n=== ${group.name} ===`);
    console.log(`  ${fileObj.fleets.length} fleets, ${fileObj.competitors.length} boats, ${fileObj.races.length} races, ${subs.length} sub-series`);
    if (!doValidate) return true;
    return validate(fileObj, subs, group);
  }

  function runMain(groups: Record<string, Group>): void {
    const args = process.argv.slice(2);
    const doValidate = !args.includes('--no-validate');
    const only = args.find((a) => !a.startsWith('--'));
    const keys = only ? [only] : Object.keys(groups);
    let ok = true;
    for (const k of keys) {
      const g = groups[k];
      if (!g) { console.error(`unknown group "${k}". Have: ${Object.keys(groups).join(', ')}`); process.exit(1); }
      if (!run(g, doValidate)) ok = false;
    }
    console.log(`\n${ok ? 'All validated groups parity-green.' : 'Some fleets diverged (see FAIL above).'}`);
    process.exit(ok ? 0 : 1);
  }

  return { year, frag, tandemFrags, fragStartKeys, seriesKey, classSeriesNames, runMain };
}

function attachSubSeries(file: SeriesFile, subs: SubSeries[]): unknown {
  return { ...file, formatVersion: 12, subSeries: subs };
}
