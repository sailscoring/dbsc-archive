import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseHalsailFleet } from '../lib/halsail/parse-results';

// The archive renderer differs from the live `_Boat` fragment (Sail number / R1
// headers, DD/MM/YYYY dates). parse-results.ts normalises both; this guards the
// archive path on a real 2025 handicap fragment.
const DIR = join(__dirname, '..', 'sources', '2025', 'results');

describe('parseHalsailFleet on archive fragments', () => {
  it('parses an IRC cruiser fragment (Cruisers 0 IRC, Thursday Overall)', () => {
    const fleet = parseHalsailFleet(readFileSync(join(DIR, 'series-36.html'), 'utf8'));
    expect(fleet.races.length).toBeGreaterThan(0);

    const r1 = fleet.races[0];
    expect(r1.date).toMatch(/^2025-\d{2}-\d{2}$/);          // DD/MM/YYYY → ISO
    expect(r1.startTime).toMatch(/^\d{2}:\d{2}:\d{2}$/);

    const winner = r1.finishers.find((f) => f.place === 1)!;
    expect(winner.sail).toBeTruthy();                        // "Sail number" → sail
    expect(winner.hcap).toBeGreaterThan(0);                 // IRC TCC parsed
    expect(winner.finish).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('reads the ECHO next-handicap column (Cruisers 0 ECHO)', () => {
    const fleet = parseHalsailFleet(readFileSync(join(DIR, 'series-33.html'), 'utf8'));
    const finisher = fleet.races[0].finishers.find((f) => f.nextHcap != null);
    expect(finisher?.nextHcap).toBeGreaterThan(0);          // "Next Hcap" chain
  });
});
