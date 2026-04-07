/**
 * Tests for seed-breach-tracker.mjs pure helpers.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync('scripts/seed-breach-tracker.mjs', 'utf8');
const pureSrc = src
  .replace(/^import\s.*$/gm, '')
  .replace(/loadEnvFile\([^)]+\);/, '')
  .replace(/await runSeed[\s\S]*/m, '')
  .replace(/verifySeedKey\([^)]+\);/, '');

const ctx = vm.createContext({ console, Date, Math, Number, Array, Map, Set, String, Object, Buffer, process: { env: {} } });
vm.runInContext(pureSrc, ctx);
const { categorizeDataClasses } = ctx;

describe('categorizeDataClasses', () => {
  it('detects credentials from passwords', () => {
    const cats = categorizeDataClasses(['Passwords', 'Email addresses', 'Usernames']);
    assert.ok(cats.includes('credentials'));
  });
  it('detects financial data', () => {
    const cats = categorizeDataClasses(['Credit cards', 'Bank account numbers']);
    assert.ok(cats.includes('financial'));
  });
  it('detects health data', () => {
    const cats = categorizeDataClasses(['Medical records', 'Health insurance']);
    assert.ok(cats.includes('health'));
  });
  it('returns empty array for unknown data classes', () => {
    const cats = categorizeDataClasses(['Unknown data type XYZ']);
    assert.deepEqual(cats, []);
  });
  it('handles empty array', () => {
    assert.deepEqual(categorizeDataClasses([]), []);
  });
  it('detects multiple categories from mixed data classes', () => {
    const cats = categorizeDataClasses(['Passwords', 'Credit cards', 'Names', 'Medical records']);
    assert.ok(cats.includes('credentials'));
    assert.ok(cats.includes('financial'));
    assert.ok(cats.includes('personal'));
    assert.ok(cats.includes('health'));
  });
});
