#!/usr/bin/env node
/**
 * seed-telegram-monitor.mjs
 * Fetches public Telegram channel posts via the /s/ web endpoint.
 * No API key, no account required — public channels only.
 * Cron: every 5 minutes.
 */

import { loadEnvFile, CHROME_UA, runSeed, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'telegram:posts:v1';
const CACHE_TTL     = 300; // 5 min

// Public channels — geopolitics, conflict intel, cybersecurity
const CHANNELS = [
  { id: 'intelslava',   label: 'Intel Slava Z',    category: 'conflict' },
  { id: 'WarMonitor3',  label: 'War Monitor',       category: 'conflict' },
  { id: 'flash_news24', label: 'Flash News',        category: 'general' },
  { id: 'CyberSecAlert', label: 'CyberSec Alert',  category: 'cybersecurity' },
  { id: 'geopolitics_live', label: 'Geopolitics Live', category: 'geopolitics' },
  { id: 'osintukraine',  label: 'OSINT Ukraine',    category: 'osint' },
];

const MAX_POSTS_PER_CHANNEL = 10;
const TELEGRAM_WEB = 'https://t.me/s/';

function parsePostsFromHtml(html, channelId, channelLabel, category) {
  const posts = [];

  // Extract message blocks
  const messageRegex = /<div class="tgme_widget_message(?:[^"]*)"[^>]*data-post="([^"]+)"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
  let match;

  while ((match = messageRegex.exec(html)) !== null && posts.length < MAX_POSTS_PER_CHANNEL) {
    const postRef = match[1]; // e.g. "channelname/12345"
    const block   = match[2];

    // Extract text
    const textMatch = block.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const rawText   = textMatch ? textMatch[1] : '';
    const text      = rawText
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim()
      .slice(0, 800);

    if (!text) continue;

    // Extract timestamp
    const timeMatch = block.match(/<time[^>]*datetime="([^"]+)"/);
    const isoTime   = timeMatch ? timeMatch[1] : '';
    const ts        = isoTime ? new Date(isoTime).getTime() : 0;

    // Extract post ID
    const postId = postRef.split('/')[1] || '';

    // Extract image count
    const photoCount = (block.match(/tgme_widget_message_photo/g) || []).length;
    const hasVideo   = block.includes('tgme_widget_message_video');

    posts.push({
      id:          `tg:${channelId}:${postId}`,
      channel:     channelId,
      channelLabel,
      category,
      text,
      url:         `https://t.me/${channelId}/${postId}`,
      publishedAt: isoTime,
      publishedMs: ts,
      photoCount,
      hasVideo,
    });
  }

  return posts;
}

async function fetchChannel(channel) {
  try {
    const resp = await fetch(`${TELEGRAM_WEB}${channel.id}`, {
      headers: {
        'User-Agent': CHROME_UA,
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!resp.ok) {
      console.warn(`  [Telegram/${channel.id}] HTTP ${resp.status}`);
      return [];
    }
    const html = await resp.text();
    const posts = parsePostsFromHtml(html, channel.id, channel.label, channel.category);
    console.log(`  [Telegram/${channel.id}] fetched ${posts.length} posts`);
    return posts;
  } catch (err) {
    console.warn(`  [Telegram/${channel.id}] failed: ${err.message}`);
    return [];
  }
}

async function fetchTelegramMonitor() {
  const channelResults = await Promise.all(CHANNELS.map(fetchChannel));
  const all = channelResults.flat();

  // Sort newest first
  all.sort((a, b) => b.publishedMs - a.publishedMs);

  const categoryBreakdown = {};
  const channelBreakdown  = {};
  for (const p of all) {
    categoryBreakdown[p.category] = (categoryBreakdown[p.category] || 0) + 1;
    channelBreakdown[p.channel]   = (channelBreakdown[p.channel] || 0) + 1;
  }

  return {
    posts: all.slice(0, 200),
    stats: {
      totalPosts:  all.length,
      channels:    CHANNELS.length,
      categoryBreakdown,
      channelBreakdown,
    },
    fetchedAt: new Date().toISOString(),
  };
}

await runSeed('telegram', 'posts', CANONICAL_KEY, fetchTelegramMonitor, {
  ttlSeconds: CACHE_TTL,
  validateFn: (d) => Array.isArray(d?.posts),
});

verifySeedKey(CANONICAL_KEY);
