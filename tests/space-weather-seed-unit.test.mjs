/**
 * Tests for seed-space-weather.mjs pure helpers.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync('scripts/seed-space-weather.mjs', 'utf8');
const pureSrc = src
  .replace(/^import\s.*$/gm, '')
  .replace(/loadEnvFile\([^)]+\);/, '')
  .replace(/await runSeed[\s\S]*/m, '')
  .replace(/verifySeedKey\([^)]+\);/, '');

const ctx = vm.createContext({ console, Date, Math, Number, Array, Map, Set, String, Object, Buffer });
vm.runInContext(pureSrc, ctx);
const { classifyFlare, kpToStormLevel } = ctx;

describe('classifyFlare', () => {
  it('classifies X-class as extreme', () => {
    assert.equal(classifyFlare('X2.5'), 'extreme');
  });
  it('classifies M-class as moderate', () => {
    assert.equal(classifyFlare('M1.0'), 'moderate');
  });
  it('classifies C-class as minor', () => {
    assert.equal(classifyFlare('C3.2'), 'minor');
  });
  it('classifies B-class as subthreshold', () => {
    assert.equal(classifyFlare('B5.1'), 'subthreshold');
  });
  it('returns unknown for null', () => {
    assert.equal(classifyFlare(null), 'unknown');
  });
  it('returns unknown for unrecognized class', () => {
    assert.equal(classifyFlare('Z9.9'), 'unknown');
  });
});

describe('kpToStormLevel', () => {
  it('returns G5_extreme for Kp >= 9', () => {
    assert.equal(kpToStormLevel(9), 'G5_extreme');
  });
  it('returns G4_severe for Kp >= 8', () => {
    assert.equal(kpToStormLevel(8), 'G4_severe');
  });
  it('returns G3_strong for Kp >= 7', () => {
    assert.equal(kpToStormLevel(7), 'G3_strong');
  });
  it('returns G2_moderate for Kp >= 6', () => {
    assert.equal(kpToStormLevel(6), 'G2_moderate');
  });
  it('returns G1_minor for Kp >= 5', () => {
    assert.equal(kpToStormLevel(5), 'G1_minor');
  });
  it('returns quiet for Kp < 5', () => {
    assert.equal(kpToStormLevel(3), 'quiet');
    assert.equal(kpToStormLevel(0), 'quiet');
  });
  it('handles string input (NOAA format)', () => {
    assert.equal(kpToStormLevel('7'), 'G3_strong');
  });
});
