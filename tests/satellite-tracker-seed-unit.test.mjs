/**
 * Tests for seed-satellite-tracker.mjs pure helpers.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync('scripts/seed-satellite-tracker.mjs', 'utf8');
const pureSrc = src
  .replace(/^import\s.*$/gm, '')
  .replace(/loadEnvFile\([^)]+\);/, '')
  .replace(/await runSeed[\s\S]*/m, '')
  .replace(/verifySeedKey\([^)]+\);/, '');

const ctx = vm.createContext({ console, Date, Math, Number, Array, Map, Set, String, Object, Buffer, Promise });
vm.runInContext(pureSrc, ctx);
const { extractOrbit, parseTle } = ctx;

describe('extractOrbit', () => {
  // ISS TLE line 2 (example)
  const issLine2 = '2 25544  51.6414 355.8420 0002660  11.5760  16.2053 15.50234497445764';
  
  it('extracts inclination from TLE line 2', () => {
    const orbit = extractOrbit(issLine2);
    assert.ok(typeof orbit.inclination === 'number');
    assert.ok(orbit.inclination > 50 && orbit.inclination < 52); // ISS ~51.6°
  });
  it('returns empty object for empty string', () => {
    const result = extractOrbit('');
    assert.equal(Object.keys(result).length, 0);
  });
  it('returns empty object for short TLE', () => {
    const result = extractOrbit('2 25544');
    assert.equal(Object.keys(result).length, 0);
  });
  it('computes altitude estimate from mean motion', () => {
    const orbit = extractOrbit(issLine2);
    assert.ok(orbit.altitudeKm !== undefined);
    assert.ok(orbit.altitudeKm > 300 && orbit.altitudeKm < 500); // ISS ~400km
  });
});

describe('parseTle', () => {
  const tleText = `ISS (ZARYA)
1 25544U 98067A   24097.54167824  .00018957  00000+0  33981-3 0  9992
2 25544  51.6414 355.8420 0002660  11.5760  16.2053 15.50234497445764
STARLINK-1234
1 44235U 19029AC  24097.00000000  .00001500  00000+0  10000-3 0  9999
2 44235  53.0000 100.0000 0001000   0.0000 360.0000 15.06000000000001`;

  it('parses two satellites from TLE text', () => {
    const sats = parseTle(tleText);
    assert.equal(sats.length, 2);
  });
  it('extracts correct satellite name', () => {
    const sats = parseTle(tleText);
    assert.equal(sats[0].name, 'ISS (ZARYA)');
    assert.equal(sats[1].name, 'STARLINK-1234');
  });
  it('preserves TLE lines', () => {
    const sats = parseTle(tleText);
    assert.ok(sats[0].tle1.startsWith('1 '));
    assert.ok(sats[0].tle2.startsWith('2 '));
  });
  it('returns empty array for empty text', () => {
    const result = parseTle('');
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 0);
  });
});
