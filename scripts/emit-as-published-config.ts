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

interface ConfigSeries {
  key: string;
  id: string;
  publishedSlug: string;
  name: string;
  venue: string;
  startDate: string;
  source: 'halsail';
  category: string;
  fleets: ConfigFleet[];
}

function run(): number {
  const sourcesDir = 'sources';
  const years = readdirSync(sourcesDir)
    .filter((d) => /^\d{4}$/.test(d))
    .sort();

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
      const usedSubPaths = new Set<string>();
      const fleets: ConfigFleet[] = cls.series.map((s) => {
        let subPath = kebab(s.name);
        let n = 2;
        while (usedSubPaths.has(subPath)) subPath = `${kebab(s.name)}-${n++}`;
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
        publishedSlug: key,
        name: `${cls.name} — ${catalog.name}`,
        venue: 'Dublin Bay',
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
