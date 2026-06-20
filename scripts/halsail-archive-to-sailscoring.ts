/**
 * Reconstruct one archived HalSail class as a single Sail Scoring series with
 * sub-series, demonstrating the tandem→sub-series fidelity model (see the app
 * repo's docs/design/dbsc-parity-plan.md, "Phase 2"). First cut: scratch
 * (place-based) classes.
 *
 * Each HalSail tandem (Overall / Series A / Series B) becomes a SubSeries that
 * selects its races *by date* — tandem race numbers are local (Series B
 * renumbers), so dates are the only stable race key. Finishes are read once
 * from the Overall fragment; A/B just name date subsets.
 *
 * Run via `pnpm to-sailscoring:archive` (add `--validate` to re-score each
 * sub-series and diff against the published summaries). The emitted file matches
 * the app's `SeriesFile` contract and is checked with `parseSeriesFile`.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { calculateFleetStandings } from '../../sailscoring/lib/scoring';
import type {
  Competitor, DiscardThreshold, Fleet, Finish, Race, RaceStart, Standing,
} from '../../sailscoring/lib/types';

const RESULTS = join(__dirname, '..', 'sources', '2025', 'results');
const OUT_DIR = join(__dirname, '..', 'sources', '2025', 'reconstructed');

// DBSC summer-series discard table (same as the 2026 files).
const DISCARDS: DiscardThreshold[] = [
  { minRaces: 4, discardCount: 1 }, { minRaces: 7, discardCount: 2 },
  { minRaces: 12, discardCount: 3 }, { minRaces: 18, discardCount: 4 },
  { minRaces: 25, discardCount: 5 }, { minRaces: 32, discardCount: 6 },
];

// HalSail result codes → engine codes. TLE (time limit expired) scores as DNF.
const CODE_MAP: Record<string, string> = { TLE: 'DNF' };
const mapCode = (c: string) => CODE_MAP[c] ?? c;

interface ClassConfig {
  out: string;
  seriesName: string;
  fleetName: string;
  boatClass: string;
  overallFile: string;        // carries every race + the finishes
  subSeries: { name: string; file: string }[];
}

const J109: ClassConfig = {
  out: 'dbsc-2025-j109',
  seriesName: 'DBSC Summer Series 2025 — J/109',
  fleetName: 'Cruisers 1 - J109',
  boatClass: 'J109',
  overallFile: 'series-47.html',
  subSeries: [
    { name: 'Thursday Overall', file: 'series-47.html' },
    { name: 'Thursday Series A', file: 'series-49.html' },
    { name: 'Thursday Series B', file: 'series-48.html' },
  ],
};

// ---- HTML helpers (permissive regex, mirroring lib/halsail/parse-results) ----

const strip = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const tablesOf = (h: string) => h.match(/<table\b[^>]*>[\s\S]*?<\/table>/gi) ?? [];
const captionOf = (t: string) => {
  const m = t.match(/<caption\b[^>]*>([\s\S]*?)<\/caption>/i);
  return m ? strip(m[1]) : '';
};
const headersOf = (t: string) =>
  (t.match(/<th\b[^>]*>[\s\S]*?<\/th>/gi) ?? []).map((th) => strip(th));
const rowsOf = (t: string) =>
  (t.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [])
    .filter((tr) => /<td\b/i.test(tr))
    .map((tr) => (tr.match(/<td\b[^>]*>[\s\S]*?<\/td>/gi) ?? []).map(strip));

const isoDate = (dmy: string) => { const [d, m, y] = dmy.split('/'); return `${y}-${m}-${d}`; };
const normSail = (s: string) => s.toUpperCase().replace(/\s+/g, '');

interface RaceResult {
  date: string; startTime: string;
  rows: { sail: string; place: number | null; code: string | null }[];
}

/** Per-race detail tables: caption "Race N (provisional) DD/MM/YYYY HH:MM:SS …". */
function parseRaces(html: string): RaceResult[] {
  const out: RaceResult[] = [];
  const seen = new Set<string>();
  for (const t of tablesOf(html)) {
    const cap = captionOf(t);
    const m = cap.match(/Race\s*\d+[^)]*\)\s*(\d{2}\/\d{2}\/\d{4})\s*(\d{2}:\d{2}:\d{2})/i);
    if (!m || /cancelled|abandoned/i.test(cap)) continue;
    const date = isoDate(m[1]);
    if (seen.has(date)) continue;      // first data table per date wins
    const keys = headersOf(t).map((h) => h.toLowerCase());
    const iPlace = keys.findIndex((k) => k.startsWith('place'));
    const iSail = keys.findIndex((k) => k.includes('sail'));
    if (iPlace < 0 || iSail < 0) continue;
    const rows = rowsOf(t).filter((c) => c.length === keys.length).map((c) => {
      const codeM = c[iPlace].match(/^([A-Z]{2,5})/);
      return {
        sail: c[iSail].trim(),
        place: codeM ? null : (Number(c[iPlace]) || null),
        code: codeM ? mapCode(codeM[1]) : null,
      };
    }).filter((r) => r.sail);
    if (rows.length === 0) continue;
    seen.add(date);
    out.push({ date, startTime: m[2], rows });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Boat register from the summary table (Rank · Sail Number · Name · Helm · …). */
function parseRegister(html: string): { sail: string; boat: string; helm: string }[] {
  const summ = tablesOf(html).find((t) => /<th\b[^>]*>\s*Rank/i.test(t));
  if (!summ) return [];
  const keys = headersOf(summ).map((h) => h.toLowerCase());
  const iSail = keys.findIndex((k) => k.includes('sail'));
  const iName = keys.findIndex((k) => k === 'name');
  const iHelm = keys.findIndex((k) => k === 'helm');
  const out: { sail: string; boat: string; helm: string }[] = [];
  for (const c of rowsOf(summ)) {
    if (c.length !== keys.length) continue;
    const sail = (c[iSail] ?? '').trim();
    if (!sail || !/\d/.test(sail)) continue;   // skip the date sub-header row
    out.push({ sail, boat: (c[iName] ?? '').trim(), helm: (c[iHelm] ?? '').trim() });
  }
  return out;
}

// ---- build ----

interface FileCompetitor {
  id: string; fleetIds: string[]; sailNumber: string; boatName?: string;
  boatClass?: string; name: string; helm?: string; club: string;
  gender: '' | 'M' | 'F'; age: number | null;
}

interface Built {
  file: unknown;
  // app-typed views for scoring
  fleet: Fleet; competitors: Competitor[]; races: Race[];
  finishes: Finish[]; raceStarts: RaceStart[];
  subSeriesRaceIds: Map<string, string[]>;
}

function build(cfg: ClassConfig): Built {
  const overallHtml = readFileSync(join(RESULTS, cfg.overallFile), 'utf8');
  const overall = parseRaces(overallHtml);
  const register = parseRegister(overallHtml);
  const fleetId = cfg.boatClass.toLowerCase().replace(/[^a-z0-9]/g, '');

  const fileCompetitors: FileCompetitor[] = register.map((b) => ({
    id: `c-${b.sail}`, fleetIds: [fleetId], sailNumber: b.sail,
    boatName: b.boat || undefined, boatClass: cfg.boatClass,
    name: b.helm || b.boat || b.sail, helm: b.helm || undefined,
    club: '', gender: '', age: null,
  }));
  // app-typed competitors for scoring (createdAt is required on the type)
  const competitors: Competitor[] = fileCompetitors.map((c) => ({
    ...c, createdAt: 0,
  })) as Competitor[];

  const races: Race[] = [];
  const finishes: Finish[] = [];
  const raceStarts: RaceStart[] = [];
  const fileRaces: unknown[] = [];
  const dateToRaceId = new Map<string, string>();

  overall.forEach((r, i) => {
    const raceId = `r-${i + 1}`;
    dateToRaceId.set(r.date, raceId);
    races.push({ id: raceId, raceNumber: i + 1, date: r.date } as Race);
    raceStarts.push({ id: `rs-${i + 1}`, raceId, fleetIds: [fleetId], startTime: r.startTime } as RaceStart);
    const present = new Map(r.rows.map((row) => [row.sail, row]));
    const fileFinishes: unknown[] = [];
    for (const comp of competitors) {
      const row = present.get(comp.sailNumber);
      const f: {
        id: string; competitorId: string; sortOrder: number | null;
        resultCode: string | null; startPresent: boolean | null;
        penaltyCode: null; penaltyOverride: null;
      } = {
        id: `f-${i + 1}-${comp.sailNumber}`, competitorId: comp.id,
        sortOrder: row && row.place != null ? row.place : null,
        resultCode: row?.place != null ? null : (row?.code ?? 'DNC'),
        startPresent: row?.place != null ? true : (row?.code ? row.code !== 'DNC' : false),
        penaltyCode: null, penaltyOverride: null,
      };
      fileFinishes.push(f);
      finishes.push({ ...f, raceId } as unknown as Finish);
    }
    fileRaces.push({
      id: raceId, raceNumber: i + 1, date: r.date,
      starts: [{ id: `rs-${i + 1}`, fleetIds: [fleetId], startTime: r.startTime }],
      finishes: fileFinishes,
    });
  });

  // Sub-series: each tandem selects its races by date (from its own fragment).
  const subSeriesRaceIds = new Map<string, string[]>();
  const subSeries = cfg.subSeries.map((ss, i) => {
    const dates = parseRaces(readFileSync(join(RESULTS, ss.file), 'utf8')).map((r) => r.date);
    const raceIds = dates.map((d) => dateToRaceId.get(d)).filter((x): x is string => !!x);
    subSeriesRaceIds.set(ss.name, raceIds);
    return { id: `ss-${i}`, name: ss.name, displayOrder: i, raceIds, startingHandicapSource: 'base' };
  });

  const fleet: Fleet = { id: fleetId, name: cfg.fleetName, displayOrder: 0, scoringSystem: 'scratch' } as Fleet;

  const file = {
    formatVersion: 9,
    seriesId: cfg.out,
    exportedAt: new Date().toISOString(),
    series: {
      id: cfg.out, name: cfg.seriesName, venue: 'Dublin Bay',
      startDate: races[0]?.date, endDate: races[races.length - 1]?.date,
      venueLogoUrl: '', eventLogoUrl: '', venueUrl: '', eventUrl: '',
      discardThresholds: DISCARDS, dnfScoring: 'startingAreaInclDnc',
      ftpHost: '', ftpPath: '', includeJsonExport: false,
      scoringMode: 'scratch',
      enabledCompetitorFields: ['boatName', 'boatClass', 'helm'],
      primaryPersonLabel: 'helm', subdivisionLabel: '',
    },
    fleets: [{ id: fleetId, name: cfg.fleetName, displayOrder: 0, scoringSystem: 'scratch' }],
    competitors: fileCompetitors,
    races: fileRaces,
    subSeries,
  };

  return { file, fleet, competitors, races, finishes, raceStarts, subSeriesRaceIds };
}

// ---- validate: re-score each sub-series, diff vs the published summary ----

function publishedNet(html: string): Map<string, number> {
  const summ = tablesOf(html).find((t) => /<th\b[^>]*>\s*Rank/i.test(t))!;
  const keys = headersOf(summ).map((h) => h.toLowerCase());
  const iSail = keys.findIndex((k) => k.includes('sail'));
  const out = new Map<string, number>();
  for (const c of rowsOf(summ)) {
    if (c.length !== keys.length) continue;
    const sail = (c[iSail] ?? '').trim();
    if (!sail || !/\d/.test(sail)) continue;
    const net = Number(c[c.length - 1]);
    if (Number.isFinite(net)) out.set(normSail(sail), net);
  }
  return out;
}

function validate(cfg: ClassConfig, b: Built): boolean {
  let ok = true;
  for (const ss of cfg.subSeries) {
    const ids = new Set(b.subSeriesRaceIds.get(ss.name) ?? []);
    const races = b.races.filter((r) => ids.has(r.id));
    const finishes = b.finishes.filter((f) => ids.has(f.raceId));
    const starts = b.raceStarts.filter((s) => ids.has(s.raceId));
    const { fleetStandings } = calculateFleetStandings(
      [b.fleet], b.competitors, races, finishes, DISCARDS, 'startingAreaInclDnc', starts, [],
    );
    const ours = new Map<string, number>(
      (fleetStandings[0].standings as Standing[]).map((s) => [normSail(s.competitor.sailNumber), s.netPoints]),
    );
    const pub = publishedNet(readFileSync(join(RESULTS, ss.file), 'utf8'));
    let diffs = 0;
    for (const [sail, net] of pub) {
      const o = ours.get(sail);
      if (o == null || Math.abs(o - net) > 0.05) { diffs++; if (diffs <= 3) console.log(`    ✗ ${ss.name} ${sail}: ours=${o} pub=${net}`); }
    }
    console.log(`  ${diffs === 0 ? 'OK  ' : 'FAIL'} ${ss.name}: ${races.length} races, ${pub.size} boats${diffs ? `, ${diffs} diffs` : ''}`);
    if (diffs) ok = false;
  }
  return ok;
}

/** Required-field check against the SeriesFile save-schema fields that
 *  `openSeriesFromFile` passes through with no import fallback (so a missing
 *  one fails import). The file was also confirmed to round-trip through the
 *  app's `parseSeriesFile` during development. */
function verifyShape(content: string): boolean {
  const f = JSON.parse(content) as {
    formatVersion: number;
    series: Record<string, unknown>;
    competitors: Record<string, unknown>[];
  };
  const need = (obj: Record<string, unknown>, keys: string[], where: string) =>
    keys.filter((k) => obj[k] === undefined).map((k) => `${where}.${k}`);
  const missing = [
    ...need(f.series, ['venueLogoUrl', 'eventLogoUrl', 'ftpHost', 'ftpPath', 'includeJsonExport'], 'series'),
    ...f.competitors.flatMap((c, i) => need(c, ['club', 'gender', 'age', 'name'], `competitors[${i}]`)),
  ];
  if (missing.length) { console.log('  ✗ missing required fields:', missing.slice(0, 6).join(', ')); return false; }
  console.log(`  OK   required fields present (v${f.formatVersion}, ${f.competitors.length} competitors)`);
  return true;
}

function main() {
  const cfg = J109;
  const b = build(cfg);
  mkdirSync(OUT_DIR, { recursive: true });
  const content = JSON.stringify(b.file, null, 2) + '\n';
  const path = join(OUT_DIR, `${cfg.out}.sailscoring`);
  writeFileSync(path, content);
  console.log(`Wrote ${path}`);
  if (process.argv.includes('--validate')) {
    console.log('Shape:');
    const shapeOk = verifyShape(content);
    console.log('Parity vs published summaries:');
    const parityOk = validate(cfg, b);
    process.exit(shapeOk && parityOk ? 0 : 1);
  }
}

main();
