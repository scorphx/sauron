/**
 * Tests for seed-ransomware-tracker.mjs pure helper functions.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync('scripts/seed-ransomware-tracker.mjs', 'utf8');
// Strip side-effectful ESM imports and the async runner
const pureSrc = src
  .replace(/^import\s.*$/gm, '')
  .replace(/loadEnvFile\([^)]+\);/, '')
  .replace(/await runSeed[\s\S]*/m, '')
  .replace(/verifySeedKey\([^)]+\);/, '');

const ctx = vm.createContext({ console, Date, Math, Number, Array, Map, Set, String, Object, Buffer });
vm.runInContext(pureSrc, ctx);
const { detectSector, isoToMs } = ctx;

describe('detectSector', () => {
  it('detects healthcare from hospital keyword', () => {
    assert.equal(detectSector('City Hospital System'), 'healthcare');
  });
  it('detects finance from bank keyword', () => {
    assert.equal(detectSector('First National Bank'), 'finance');
  });
  it('detects government from gov keyword', () => {
    assert.equal(detectSector('Municipal Gov Services'), 'government');
  });
  it('detects technology from tech keyword', () => {
    assert.equal(detectSector('CloudTech Solutions'), 'technology');
  });
  it('returns other for unknown sector', () => {
    assert.equal(detectSector('Random Company XYZ'), 'other');
  });
  it('uses description for additional keyword matching', () => {
    assert.equal(detectSector('ACME Corp', 'specializing in pharma distribution'), 'healthcare');
  });
});

describe('isoToMs', () => {
  it('converts valid ISO date to milliseconds', () => {
    const ms = isoToMs('2024-01-15T12:00:00Z');
    assert.ok(ms > 0);
    assert.ok(ms < Date.now() + 86400_000);
  });
  it('returns 0 for null', () => {
    assert.equal(isoToMs(null), 0);
  });
  it('returns 0 for empty string', () => {
    assert.equal(isoToMs(''), 0);
  });
  it('returns falsy for invalid date (new Date parses garbage to NaN)', () => {
    const result = isoToMs('not-a-date');
    assert.ok(!result || isNaN(result));
  });
});
