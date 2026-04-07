/**
 * Tests for seed-news-aggregator.mjs pure helpers.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync('scripts/seed-news-aggregator.mjs', 'utf8');
const pureSrc = src
  .replace(/^import\s.*$/gm, '')
  .replace(/loadEnvFile\([^)]+\);/, '')
  .replace(/await runSeed[\s\S]*/m, '')
  .replace(/verifySeedKey\([^)]+\);/, '');

const ctx = vm.createContext({ console, Date, Math, Number, Array, Map, Set, String, Object, Buffer, process: { env: {} } });
vm.runInContext(pureSrc, ctx);
const { parseRssDate, parseRssItems, extractTextFromXml } = ctx;

describe('parseRssDate', () => {
  it('parses valid RFC 2822 date', () => {
    const ms = parseRssDate('Mon, 07 Apr 2025 12:00:00 GMT');
    assert.ok(ms > 0);
  });
  it('parses ISO date', () => {
    const ms = parseRssDate('2025-04-07T12:00:00Z');
    assert.ok(ms > 0);
  });
  it('returns 0 for empty string', () => {
    assert.equal(parseRssDate(''), 0);
  });
  it('returns 0 for null', () => {
    assert.equal(parseRssDate(null), 0);
  });
});

describe('extractTextFromXml', () => {
  it('extracts simple tag content', () => {
    const xml = '<title>Breaking News: Something Happened</title>';
    assert.equal(extractTextFromXml(xml, 'title'), 'Breaking News: Something Happened');
  });
  it('extracts CDATA content', () => {
    const xml = '<description><![CDATA[Rich content here]]></description>';
    assert.equal(extractTextFromXml(xml, 'description'), 'Rich content here');
  });
  it('decodes HTML entities', () => {
    const xml = '<title>AT&amp;T announces deal</title>';
    assert.equal(extractTextFromXml(xml, 'title'), 'AT&T announces deal');
  });
  it('returns empty string when tag not found', () => {
    assert.equal(extractTextFromXml('<foo>bar</foo>', 'baz'), '');
  });
});

describe('parseRssItems', () => {
  const sampleXml = `
    <rss><channel>
      <item>
        <title>Test Article</title>
        <link>https://example.com/test</link>
        <description>Article description</description>
        <pubDate>Mon, 07 Apr 2025 10:00:00 GMT</pubDate>
      </item>
      <item>
        <title>Another Article</title>
        <link>https://different-domain.org/another-article</link>
        <pubDate>Mon, 07 Apr 2025 09:00:00 GMT</pubDate>
      </item>
    </channel></rss>
  `;

  it('parses RSS items correctly', () => {
    const items = parseRssItems(sampleXml, 'test', 'Test Source', 'center');
    assert.equal(items.length, 2);
    assert.equal(items[0].title, 'Test Article');
    assert.equal(items[0].source, 'test');
    assert.equal(items[0].sourceLabel, 'Test Source');
    assert.equal(items[0].bias, 'center');
  });

  it('generates unique IDs for each item', () => {
    const items = parseRssItems(sampleXml, 'test', 'Test', 'center');
    const ids = items.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('skips items without title or link', () => {
    const badXml = '<rss><channel><item><description>No title</description></item></channel></rss>';
    const items = parseRssItems(badXml, 'test', 'Test', 'center');
    assert.equal(items.length, 0);
  });
});
