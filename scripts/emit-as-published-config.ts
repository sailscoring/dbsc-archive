/**
 * Emit `as-published.config.json` from the HalSail captures (ADR-010,
 * sailscoring#283) — the input to the app repo's `pnpm archive-generate`.
 *
 * One as-published series per (class, dataset year); each of the class's
 * HalSail series pages ("2024 Saturday Series A", "Saturday Overall", …)
 * becomes a fleet page under the class's slug. The whole mapping comes from
 * the per-year `catalog.json` the capture step wrote, so this needs no
 * network and re-runs deterministically.
 *
 *   pnpm emit-as-published            # writes ./as-published.config.json
 *
 * Ids are UUIDv5 over the stable per-series key, minted with the archive-kit
 * namespace, so regeneration can never mint duplicates.
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The public URL scheme reuses the reconstruction era's: one shared slug per
 * season year, each fleet page at `{sub-series}/{class}` beneath it
 * (`/p/dbsc/2022/saturday-overall/beneteau-211-echo`). Those original paths
 * are pinned in `published-paths.json` (dumped from production — URL
 * stability is data, never derived); pages the reconstruction never
 * published get derived paths in the same shape. The join is by name, with
 * an alias table for classes the two eras named differently.
 */

/** HalSail catalog class name → the reconstruction's fleet name, where the
 *  normalisation rules below can't bridge them. */
const CLASS_ALIASES: Record<string, string> = {
  'Cruisers 1 - J109': 'J/109',
  'Cruisers 2 - Sigma33': 'Sigma 33',
  Sportsboats: 'Mixed Sportsboats',
  'Cruisers 4A-5A NS VPRS': 'Cruisers 4-5A VPRS',
  'Cruisers 4B-5B NS VPRS': 'Cruisers 4-5B VPRS',
};

/** Name-join normalisation: drop a trailing day qualifier, the "(A+B)"
 *  pooling note, the "NS" (non-spinnaker) tag the catalog carries but the
 *  reconstruction didn't, and all punctuation/case. */
function normName(s: string): string {
  return s
    .replace(/\s*\((Sat|Thu|Tue|Wed|Weds|S|T|W)\)\s*$/i, '')
    .replace(/\(\+?A\+B\)/gi, '')
    .replace(/\(\+?5A\)/gi, '5a')
    .replace(/\bNS\b/gi, '')
    .replace(/\bScratch\s*$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

interface PinnedPage {
  year: string;
  subSeries: string;
  fleet: string;
  subPath: string;
}

/** Day qualifier from a catalog class name — "Cruisers 3 Echo (Tue)" → Tue.
 *  A day-qualified class may only claim pages of its own day: a tandem class
 *  carries other days' fleets too, but those pages belong to the dedicated
 *  per-day class. */
function classDay(name: string): string | null {
  const m = /\((Sat|Thu|Tue|Wed|Weds)\)\s*$/i.exec(name);
  return m ? m[1].toLowerCase().slice(0, 3) : null;
}

function subSeriesDay(name: string): string | null {
  const m = /^\s*(?:\d{4}\s+)?(Saturday|Thursday|Tuesday|Wednesday|Weds)/i.exec(name);
  return m ? m[1].toLowerCase().slice(0, 3).replace('wed', 'wed') : null;
}

// Matches lib/archive-kit/ids.ts in the app repo. Fixed forever: the derived
// ids are persisted, and the identity links hang off the competitor rows.
const ARCHIVE_NS = '7c1f9d54-3e82-5b17-9a60-2f4d8c5e0b39';
const REPO_KEY = 'dbsc-archive';

function uuidv5(name: string, namespace: string = ARCHIVE_NS): string {
  const ns = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1')
    .update(ns)
    .update(Buffer.from(name, 'utf8'))
    .digest();
  const bytes = hash.subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function kebab(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'series'
  );
}

interface CatalogSeries {
  key: string;
  name: string;
  resultsPath: string;
}

interface CatalogClass {
  key: string;
  name: string;
  series: CatalogSeries[];
}

interface Catalog {
  dsKey: string;
  name: string;
  year: string;
  classes: CatalogClass[];
}

interface ConfigFleet {
  name: string;
  subPath: string;
  file: string;
}

function loadPins(): Map<string, PinnedPage> {
  const raw = JSON.parse(readFileSync('published-paths.json', 'utf8')) as {
    pages: PinnedPage[];
  };
  const map = new Map<string, PinnedPage>();
  for (const p of raw.pages) {
    map.set(`${p.year}|${normName(p.subSeries)}|${normName(p.fleet)}`, p);
  }
  return map;
}

interface ConfigSeries {
  key: string;
  id: string;
  publishedSlug: string;
  name: string;
  venue: string;
  startDate: string;
  venueUrl: string;
  venueLogoUrl: string;
  source: 'halsail';
  category: string;
  fleets: ConfigFleet[];
}

function run(): number {
  const sourcesDir = 'sources';
  const years = readdirSync(sourcesDir)
    .filter((d) => /^\d{4}$/.test(d))
    .sort();

  const pins = loadPins();
  const claimed = new Set<string>();
  let pinned = 0;
  let derived = 0;

  const series: ConfigSeries[] = [];
  for (const year of years) {
    let catalog: Catalog;
    try {
      catalog = JSON.parse(
        readFileSync(join(sourcesDir, year, 'catalog.json'), 'utf8'),
      ) as Catalog;
    } catch {
      continue; // 2026-live has no archive catalog
    }
    for (const cls of catalog.classes) {
      const key = `dbsc-${year}-${kebab(cls.name)}`;
      const clsNorm = normName(CLASS_ALIASES[cls.name] ?? cls.name);
      const usedSubPaths = new Set<string>();
      const day = classDay(cls.name);
      const fleets: ConfigFleet[] = cls.series.map((s) => {
        let pin = pins.get(`${year}|${normName(s.name)}|${clsNorm}`);
        if (pin && day) {
          const pageDay = subSeriesDay(pin.subSeries);
          if (pageDay && pageDay !== day) pin = undefined;
        }
        let subPath: string;
        if (pin) {
          subPath = pin.subPath;
          claimed.add(`${pin.year}|${pin.subPath}`);
          pinned++;
        } else {
          // Never published by the reconstruction — a new page, in the
          // same {sub-series}/{class} shape as its pinned neighbours.
          subPath = `${kebab(s.name)}/${kebab(cls.name)}`;
          derived++;
        }
        let n = 2;
        const base = subPath;
        while (usedSubPaths.has(subPath)) subPath = `${base}-${n++}`;
        usedSubPaths.add(subPath);
        return {
          name: s.name,
          subPath,
          file: join(sourcesDir, year, s.resultsPath),
        };
      });
      if (fleets.length === 0) continue;
      series.push({
        key,
        id: uuidv5(`${REPO_KEY}/series/${key}`),
        // One shared slug per season year: /p/dbsc/{year}/{sub-series}/{class}.
        publishedSlug: year,
        name: `${cls.name} — ${catalog.name}`,
        venue: 'Dublin Bay',
        venueUrl: 'https://www.dbsc.org',
        venueLogoUrl: 'https://logos.sailscoring.ie/dbsc.png',
        // The catalog carries no dates; late April is when the DBSC summer
        // season starts, and the year is what the app's grouping reads.
        startDate: `${year}-04-27`,
        source: 'halsail',
        // Initial in-app filing: one category per season year.
        category: year,
        fleets,
      });
    }
  }

  // Paths are a per-year namespace shared by every class — a collision
  // across series would make the ingest reject the corpus.
  const seen = new Set<string>();
  for (const s of series) {
    for (const f of s.fleets) {
      const k = `${s.publishedSlug}|${f.subPath}`;
      if (seen.has(k)) {
        console.error(`  ! duplicate page path across classes: /p/dbsc/${s.publishedSlug}/${f.subPath} (${s.key})`);
        return 1;
      }
      seen.add(k);
    }
  }

  // Every original page must be claimed — an unclaimed pin is a URL the
  // rework would break.
  const unclaimed = [...pins.values()].filter(
    (p) => !claimed.has(`${p.year}|${p.subPath}`),
  );
  console.log(`${pinned} pages pinned to original paths, ${derived} new pages derived`);
  if (unclaimed.length > 0) {
    for (const p of unclaimed.slice(0, 20)) {
      console.error(`  ! unclaimed original page: /p/dbsc/${p.year}/${p.subPath} (${p.subSeries} / ${p.fleet})`);
    }
    console.error(`${unclaimed.length} original pages unclaimed — refusing to emit`);
    return 1;
  }

  const config = {
    version: 1,
    out: 'as-published',
    series,
  };
  writeFileSync(
    'as-published.config.json',
    `${JSON.stringify(config, null, 2)}\n`,
  );
  console.log(
    `as-published.config.json: ${series.length} series across ${years.join(', ')}`,
  );
  return 0;
}

process.exit(run());
