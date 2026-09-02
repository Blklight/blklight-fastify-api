import { generateDrizzleJson } from 'drizzle-kit/api';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function schemaFilesUnder(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      schemaFilesUnder(full, files);
    } else if (entry.name.endsWith('.schema.ts')) {
      files.push(full);
    }
  }
  return files;
}

function deepDiff(a: unknown, b: unknown, prefix = ''): string[] {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (typeof a !== typeof b) return [`${prefix}: type ${typeof a} vs ${typeof b}`];
  if (a === null || b === null || typeof a !== 'object') {
    return [`${prefix}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`];
  }
  const diffs: string[] = [];
  const keys = new Set([...Object.keys(a as Record<string, unknown>), ...Object.keys(b as Record<string, unknown>)]);
  for (const key of keys) {
    diffs.push(...deepDiff((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], prefix ? `${prefix}.${key}` : key));
  }
  return diffs;
}

async function run() {
  const schemaFiles = schemaFilesUnder('src/features');

  const imports: Record<string, unknown> = {};
  for (const file of schemaFiles) {
    const rel = join(process.cwd(), file).replace(/\.ts$/, '');
    const mod = (await import(`${pathToFileURL(resolve(file)).href}?t=${Date.now()}`)) as Record<string, unknown>;
    for (const [exportName, value] of Object.entries(mod)) {
      imports[`${rel}:${exportName}`] = value;
    }
  }

  const curSnapshot = generateDrizzleJson(imports);

  const journal = JSON.parse(readFileSync('drizzle/migrations/meta/_journal.json', 'utf8')) as {
    entries: Array<{ idx: number; tag: string }>;
  };
  const last = journal.entries[journal.entries.length - 1];
  if (!last) {
    console.error('journal has no entries');
    process.exit(1);
  }
  const snapshotFile = `drizzle/migrations/meta/${String(last.idx).padStart(4, '0')}_snapshot.json`;
  const journalSnapshot = JSON.parse(readFileSync(snapshotFile, 'utf8')) as { tables: Record<string, unknown> };

  const curTables = curSnapshot.tables as Record<string, unknown>;
  const journalTables = journalSnapshot.tables;
  const allKeys = new Set([...Object.keys(curTables), ...Object.keys(journalTables)]);
  let drift = false;

  for (const tableKey of [...allKeys].sort()) {
    if (!curTables[tableKey]) {
      console.log(`[DRIFT] table missing from schema.ts: ${tableKey}`);
      drift = true;
      continue;
    }
    if (!journalTables[tableKey]) {
      console.log(`[DRIFT] table missing from latest snapshot: ${tableKey}`);
      drift = true;
      continue;
    }
    const diffs = deepDiff(curTables[tableKey], journalTables[tableKey]);
    if (diffs.length > 0) {
      console.log(`[DRIFT] table ${tableKey}:`);
      for (const d of diffs.slice(0, 20)) console.log(`  ${d}`);
      if (diffs.length > 20) console.log(`  ... and ${diffs.length - 20} more`);
      drift = true;
    }
  }

  console.log(`\nCompared ${Object.keys(journalTables).length} journal tables vs ${Object.keys(curTables).length} schema.ts tables`);
  if (drift) {
    console.error('\nDrift detected between latest snapshot and schema.ts. Run db:generate.');
    process.exit(1);
  }
  console.log('No drift: latest journal snapshot matches schema.ts.');
}

run().catch((err) => {
  console.error('Migration check failed:', err);
  process.exit(1);
});