#!/usr/bin/env node
/**
 * seed-social-pulse.mjs
 * Aggregates real-time social signals from:
 *   - Reddit JSON API (no auth required)
 *   - HackerNews Firebase API (no auth required)
 * Cron: every 5 minutes.
 */

import { loadEnvFile, CHROME_UA, runSeed, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'social:pulse:v1';
const TRENDING_KEY  = 'social:trending:v1';
const CACHE_TTL     = 300; // 5 min

const SUBREDDITS = [
  'worldnews', 'geopolitics', 'OSINT', 'cybersecurity', 'natsec',
  'GlobalPowers', 'europe', 'CredibleDefense', 'intelligence',
];

const REDDIT_BASE   = 'https://www.reddit.com/r';
const HN_TOP_URL    = 'https://hacker-news.firebaseio.com/v0/topstories.json';
const HN_ITEM_URL   = (id) => `https://hacker-news.firebaseio.com/v0/item/${id}.json`;

const MAX_POSTS_PER_SUB  = 10;
const MAX_HN_STORIES     = 15;
const MAX_TOTAL_POSTS    = 200;

const SECURITY_KEYWORDS = ['hack','breach','exploit','vulnerability','ransomware','malware','phishing',
  'zero-day','cve','ddos','intrusion','cyber','leak','surveillance','espionage'];
const CONFLICT_KEYWORDS = ['war','conflict','military','attack','strike','sanctions','nato','troops',
  'bomb','missile','invasion','ceasefire','crisis','protest','coup'];
const ECONOMY_KEYWORDS  = ['inflation','recession','gdp','unemployment','fed','interest rate',
  'tariff','trade war','deficit','debt','currency','crypto','stock'];

function detectTopics(title, text = '') {
  const content = `${title} ${text}`.toLowerCase();
  const topics = [];
  if (SECURITY_KEYWORDS.some((k) => content.includes(k))) topics.push('cybersecurity');
  if (CONFLICT_KEYWORDS.some((k) => content.includes(k))) topics.push('geopolitics');
  if (ECONOMY_KEYWORDS.some((k) => content.includes(k)))  topics.push('economics');
  return topics;
}

function scorePost(ups, comments, age_hours) {
  // Decay score with age; boost engagement
  const decay = Math.exp(-age_hours / 12);
  return ((ups || 0) + (comments || 0) * 3) * decay;
}

async function fetchSubreddit(sub) {
  try {
    const resp = await fetch(`${REDDIT_BASE}/${sub}/new.json?limit=${MAX_POSTS_PER_SUB}&raw_json=1`, {
      headers: { 'User-Agent': 'WorldMonitor:SauronBot/1.0 (by /u/worldmonitor_bot)' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!resp.ok) return [];
    const json = await resp.json();
    return (json?.data?.children || []).map((c) => {
      const p = c.data;
      const createdMs = (p.created_utc || 0) * 1000;
      const ageH = (Date.now() - createdMs) / 3_600_000;
      return {
        id:       `reddit:${p.id}`,
        source:   'reddit',
        sub:      sub,
        title:    (p.title || '').slice(0, 200),
        url:      p.url || `https://reddit.com${p.permalink}`,
        permalink: `https://reddit.com${p.permalink}`,
        author:   p.author || '[deleted]',
        ups:      p.ups || 0,
        comments: p.num_comments || 0,
        score:    scorePost(p.ups, p.num_comments, ageH),
        createdMs,
        topics:   detectTopics(p.title, p.selftext),
      };
    });
  } catch (err) {
    console.warn(`  [Reddit/${sub}] failed: ${err.message}`);
    return [];
  }
}

async function fetchHackerNews() {
  try {
    const topResp = await fetch(HN_TOP_URL, { signal: AbortSignal.timeout(8_000) });
    if (!topResp.ok) return [];
    const ids = await topResp.json();

    const items = await Promise.allSettled(
      ids.slice(0, MAX_HN_STORIES).map((id) =>
        fetch(HN_ITEM_URL(id), { signal: AbortSignal.timeout(5_000) }).then((r) => r.json()),
      ),
    );

    return items
      .filter((r) => r.status === 'fulfilled' && r.value?.title)
      .map((r) => {
        const p = r.value;
        const createdMs = (p.time || 0) * 1000;
        const ageH = (Date.now() - createdMs) / 3_600_000;
        return {
          id:       `hn:${p.id}`,
          source:   'hackernews',
          sub:      'hackernews',
          title:    (p.title || '').slice(0, 200),
          url:      p.url || `https://news.ycombinator.com/item?id=${p.id}`,
          permalink: `https://news.ycombinator.com/item?id=${p.id}`,
          author:   p.by || '',
          ups:      p.score || 0,
          comments: p.descendants || 0,
          score:    scorePost(p.score, p.descendants, ageH),
          createdMs,
          topics:   detectTopics(p.title),
        };
      });
  } catch (err) {
    console.warn(`  [HackerNews] failed: ${err.message}`);
    return [];
  }
}

async function fetchSocialPulse() {
  // Fetch all sources in parallel
  const [hnPosts, ...subPosts] = await Promise.all([
    fetchHackerNews(),
    ...SUBREDDITS.map(fetchSubreddit),
  ]);

  const all = [...hnPosts, ...subPosts.flat()];
  all.sort((a, b) => b.score - a.score);
  const posts = all.slice(0, MAX_TOTAL_POSTS);

  // Topic aggregation for trending
  const topicCounts = {};
  const sourceBreakdown = {};
  for (const p of posts) {
    sourceBreakdown[p.source] = (sourceBreakdown[p.source] || 0) + 1;
    for (const t of p.topics) {
      topicCounts[t] = (topicCounts[t] || 0) + 1;
    }
  }

  const trending = Object.entries(topicCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([topic, count]) => ({ topic, count }));

  return {
    posts,
    trending,
    stats: {
      totalPosts: posts.length,
      sourceBreakdown,
      fetchedAt: new Date().toISOString(),
    },
    fetchedAt: new Date().toISOString(),
  };
}

await runSeed('social', 'pulse', CANONICAL_KEY, fetchSocialPulse, {
  ttlSeconds: CACHE_TTL,
  validateFn: (d) => Array.isArray(d?.posts),
  extraKeys: [{ key: TRENDING_KEY, getValue: (d) => ({ trending: d.trending, fetchedAt: d.fetchedAt }) }],
});

verifySeedKey(CANONICAL_KEY);
