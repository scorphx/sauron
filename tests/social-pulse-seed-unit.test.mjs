/**
 * Tests for seed-social-pulse.mjs pure helpers.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync('scripts/seed-social-pulse.mjs', 'utf8');
const pureSrc = src
  .replace(/^import\s.*$/gm, '')
  .replace(/loadEnvFile\([^)]+\);/, '')
  .replace(/await runSeed[\s\S]*/m, '')
  .replace(/verifySeedKey\([^)]+\);/, '');

const ctx = vm.createContext({ console, Date, Math, Number, Array, Map, Set, String, Object, Buffer });
vm.runInContext(pureSrc, ctx);
const { detectTopics, scorePost } = ctx;

describe('detectTopics', () => {
  it('detects cybersecurity from hack keyword', () => {
    const topics = detectTopics('Major hack at tech company', '');
    assert.ok(topics.includes('cybersecurity'));
  });
  it('detects geopolitics from war keyword', () => {
    const topics = detectTopics('War escalates in conflict zone', '');
    assert.ok(topics.includes('geopolitics'));
  });
  it('detects economics from inflation keyword', () => {
    const topics = detectTopics('Inflation hits record high', '');
    assert.ok(topics.includes('economics'));
  });
  it('returns empty array for unrelated content', () => {
    const result = detectTopics('Weather is nice today', '');
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 0);
  });
  it('detects multiple topics', () => {
    const topics = detectTopics('Hack causes economic recession amid war', '');
    assert.ok(topics.includes('cybersecurity'));
    assert.ok(topics.includes('economics'));
    assert.ok(topics.includes('geopolitics'));
  });
});

describe('scorePost', () => {
  it('returns positive score for upvoted post', () => {
    assert.ok(scorePost(100, 50, 1) > 0);
  });
  it('decays score with age', () => {
    const fresh = scorePost(100, 50, 0.5);
    const old   = scorePost(100, 50, 48);
    assert.ok(fresh > old);
  });
  it('handles zero upvotes', () => {
    assert.ok(scorePost(0, 10, 1) >= 0);
  });
  it('handles null/undefined gracefully', () => {
    assert.ok(scorePost(undefined, undefined, 1) >= 0);
  });
});
