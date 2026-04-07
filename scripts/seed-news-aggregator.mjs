#!/usr/bin/env node
/**
 * seed-news-aggregator.mjs
 * Aggregates top headlines from multiple free RSS/JSON sources:
 *   - Reuters RSS (world news)
 *   - BBC World RSS
 *   - Al Jazeera RSS
 *   - AP News RSS
 *   - GDELT Top 10 (free, no key)
 *   - NewsAPI (optional, free dev key)
 * Cron: every 10 minutes.
 */

import { loadEnvFile, CHROME_UA, runSeed, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'news:headlines:v1';
const TRENDING_KEY  = 'news:trending-topics:v1';
const CACHE_TTL     = 600; // 10 min

const RSS_FEEDS = [
  { id: 'reuters',    label: 'Reuters',    url: 'https://feeds.reuters.com/reuters/worldNews', bias: 'center' },
  { id: 'bbc',        label: 'BBC',        url: 'https://feeds.bbci.co.uk/news/world/rss.xml', bias: 'center-left' },
  { id: 'aljazeera',  label: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', bias: 'center-left' },
  { id: 'apnews',     label: 'AP News',    url: 'https://rsshub.app/apnews/topics/world-news', bias: 'center' },
  { id: 'guardian',   label: 'Guardian',   url: 'https://www.theguardian.com/world/rss', bias: 'center-left' },
  { id: 'dw',         label: 'DW',         url: 'https://rss.dw.com/rdf/rss-en-world', bias: 'center' },
];

// GDELT top news API — free, no key
const GDELT_TOP_URL = 'https://api.gdeltproject.org/api/v2/doc/doc?query=sourcelang:english&mode=artlist&maxrecords=25&format=json&sort=ToneDesc';

const MAX_PER_FEED = 8;
const MAX_TOTAL    = 100;

function parseRssDate(dateStr) {
  if (!dateStr) return 0;
  try { return new Date(dateStr).getTime(); } catch { return 0; }
}

function extractTextFromXml(xml, tag) {
  // Use doubled backslashes so RegExp receives correct escape sequences
  const re = new RegExp('<' + tag + '[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/' + tag + '>', 'i');
  const m = xml.match(re);
  return m ? m[1].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"') : '';
}

function parseRssItems(xml, feedId, feedLabel, bias) {
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  const items = [];
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < MAX_PER_FEED) {
    const item = match[1];
    const title = extractTextFromXml(item, 'title');
    const link  = extractTextFromXml(item, 'link') || extractTextFromXml(item, 'guid');
    const desc  = extractTextFromXml(item, 'description');
    const pubDate = extractTextFromXml(item, 'pubDate');
    if (!title || !link) continue;
    items.push({
      id:        `${feedId}:${Buffer.from(link).toString('base64').slice(0, 16)}`,
      source:    feedId,
      sourceLabel: feedLabel,
      bias,
      title:     title.slice(0, 200),
      url:       link.slice(0, 500),
      summary:   desc.replace(/<[^>]*>/g, '').trim().slice(0, 400),
      publishedMs: parseRssDate(pubDate),
      publishedAt: pubDate || '',
    });
  }
  return items;
}

async function fetchRssFeed(feed) {
  try {
    const resp = await fetch(feed.url, {
      headers: { 'User-Agent': CHROME_UA, Accept: 'application/rss+xml,application/xml,text/xml' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) { console.warn(`  [RSS/${feed.id}] HTTP ${resp.status}`); return []; }
    const xml = await resp.text();
    return parseRssItems(xml, feed.id, feed.label, feed.bias);
  } catch (err) {
    console.warn(`  [RSS/${feed.id}] failed: ${err.message}`);
    return [];
  }
}

async function fetchGdelt() {
  try {
    const resp = await fetch(GDELT_TOP_URL, {
      headers: { 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return [];
    const json = await resp.json();
    return (json?.articles || []).slice(0, MAX_PER_FEED).map((a) => ({
      id:          `gdelt:${Buffer.from(a.url || '').toString('base64').slice(0, 16)}`,
      source:      'gdelt',
      sourceLabel: 'GDELT',
      bias:        'aggregated',
      title:       (a.title || '').slice(0, 200),
      url:         (a.url || '').slice(0, 500),
      summary:     '',
      publishedMs: parseRssDate(a.seendate),
      publishedAt: a.seendate || '',
    }));
  } catch (err) {
    console.warn(`  [GDELT] failed: ${err.message}`);
    return [];
  }
}

async function fetchNewsApi() {
  const key = process.env.NEWS_API_KEY;
  if (!key) return [];
  try {
    const url = `https://newsapi.org/v2/top-headlines?language=en&pageSize=20&apiKey=${key}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) return [];
    const json = await resp.json();
    return (json?.articles || []).slice(0, MAX_PER_FEED).map((a) => ({
      id:          `newsapi:${Buffer.from(a.url || '').toString('base64').slice(0, 16)}`,
      source:      'newsapi',
      sourceLabel: a.source?.name || 'NewsAPI',
      bias:        'aggregated',
      title:       (a.title || '').slice(0, 200),
      url:         (a.url || '').slice(0, 500),
      summary:     (a.description || '').slice(0, 400),
      publishedMs: parseRssDate(a.publishedAt),
      publishedAt: a.publishedAt || '',
    }));
  } catch { return []; }
}

async function fetchNewsAggregator() {
  const [gdeltItems, newsApiItems, ...rssItems] = await Promise.all([
    fetchGdelt(),
    fetchNewsApi(),
    ...RSS_FEEDS.map(fetchRssFeed),
  ]);

  // Deduplicate by URL, merge all sources
  const seen = new Set();
  const all = [...gdeltItems, ...newsApiItems, ...rssItems.flat()].filter((a) => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return !!a.title;
  });

  // Sort newest first
  all.sort((a, b) => b.publishedMs - a.publishedMs);
  const articles = all.slice(0, MAX_TOTAL);

  // Source breakdown
  const sourceBreakdown = {};
  for (const a of articles) {
    sourceBreakdown[a.source] = (sourceBreakdown[a.source] || 0) + 1;
  }

  return {
    articles,
    stats: {
      totalArticles: articles.length,
      sourceBreakdown,
    },
    fetchedAt: new Date().toISOString(),
  };
}

await runSeed('news', 'headlines', CANONICAL_KEY, fetchNewsAggregator, {
  ttlSeconds: CACHE_TTL,
  validateFn: (d) => Array.isArray(d?.articles) && d.articles.length > 0,
  extraKeys: [{ key: TRENDING_KEY, getValue: (d) => ({ stats: d.stats, fetchedAt: d.fetchedAt }) }],
});

verifySeedKey(CANONICAL_KEY);
