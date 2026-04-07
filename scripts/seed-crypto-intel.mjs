#!/usr/bin/env node
/**
 * seed-crypto-intel.mjs
 * On-chain intelligence from free public APIs:
 *   - Blockchair multi-chain stats (BTC/ETH/SOL/etc.)
 *   - Etherscan free tier (large transfers, contract activity)
 *   - ChainAbuse scam/hack address reports
 * Cron: every 6 hours.
 */

import { loadEnvFile, CHROME_UA, runSeed, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'crypto:intel:v1';
const ONCHAIN_KEY   = 'crypto:onchain-stats:v1';
const CACHE_TTL     = 21600; // 6h

const BLOCKCHAIR_BASE  = 'https://api.blockchair.com';
const CHAINABUSE_URL   = 'https://www.chainabuse.com/api/reports?limit=50&sort=createdAt&order=desc';
const ETHERSCAN_LARGE  = 'https://api.etherscan.io/api?module=account&action=txlistinternal&sort=desc&page=1&offset=20';

const CHAINS = ['bitcoin', 'ethereum', 'solana', 'dogecoin', 'litecoin'];

async function fetchBlockchairStats() {
  const results = {};
  await Promise.all(CHAINS.map(async (chain) => {
    try {
      const resp = await fetch(`${BLOCKCHAIR_BASE}/${chain}/stats`, {
        headers: { 'User-Agent': CHROME_UA },
        signal: AbortSignal.timeout(12_000),
      });
      if (!resp.ok) return;
      const json = await resp.json();
      const data = json?.data;
      if (!data) return;

      results[chain] = {
        chain,
        blockHeight:        data.blocks || data.blocks_24h || 0,
        transactions24h:    data.transactions_24h || 0,
        volume24hUsd:       data.volume_24h_approximate || data.circulation_approximate || 0,
        avgTransactionFee:  data.median_transaction_fee_usd_24h || data.average_transaction_fee_usd_24h || 0,
        hashrateGhs:        data.hashrate_24h || null,
        mempoolSize:        data.mempool_transactions || null,
        mempoolTxs:         data.mempool_transactions || null,
        inflation24h:       data.inflation_24h || null,
        marketPriceUsd:     data.market_price_usd || null,
        circulatingUsd:     data.market_cap_usd || null,
      };
    } catch (err) {
      console.warn(`  [Blockchair/${chain}] failed: ${err.message}`);
    }
  }));
  return results;
}

async function fetchChainAbuse() {
  try {
    const resp = await fetch(CHAINABUSE_URL, {
      headers: { 'User-Agent': CHROME_UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) return [];
    const json = await resp.json();
    const reports = json?.reports || json?.data || [];
    return reports.slice(0, 100).map((r) => ({
      id:          r.id || r._id || '',
      address:     (r.address || r.addresses?.[0] || '').slice(0, 100),
      chain:       (r.chain || r.blockchain || 'unknown').toLowerCase(),
      category:    r.category || r.type || 'scam',
      description: (r.description || '').slice(0, 300),
      reportedAt:  r.createdAt || r.reported_at || '',
      url:         r.url || '',
    }));
  } catch (err) {
    console.warn(`  [ChainAbuse] failed: ${err.message}`);
    return [];
  }
}

async function fetchLargeEthTransfers() {
  const key = process.env.ETHERSCAN_API_KEY;
  if (!key) return [];
  try {
    const url = `https://api.etherscan.io/api?module=account&action=tokentx&contractaddress=0xdac17f958d2ee523a2206206994597c13d831ec7&page=1&offset=20&sort=desc&apikey=${key}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) return [];
    const json = await resp.json();
    return (json?.result || []).slice(0, 20).map((tx) => ({
      hash:        tx.hash,
      from:        tx.from,
      to:          tx.to,
      value:       parseInt(tx.value || '0', 10) / 1e6, // USDT has 6 decimals
      token:       tx.tokenSymbol || 'USDT',
      timeStamp:   parseInt(tx.timeStamp || '0', 10) * 1000,
      blockNumber: parseInt(tx.blockNumber || '0', 10),
    })).filter((tx) => tx.value > 1_000_000); // >$1M transfers only
  } catch (err) {
    console.warn(`  [Etherscan] failed: ${err.message}`);
    return [];
  }
}

async function fetchCryptoIntel() {
  const [chainStats, abuseReports, largeTransfers] = await Promise.all([
    fetchBlockchairStats(),
    fetchChainAbuse(),
    fetchLargeEthTransfers(),
  ]);

  // Aggregate abuse by chain
  const abuseByChain = {};
  const abuseByCategory = {};
  for (const r of abuseReports) {
    abuseByChain[r.chain]       = (abuseByChain[r.chain] || 0) + 1;
    abuseByCategory[r.category] = (abuseByCategory[r.category] || 0) + 1;
  }

  return {
    chainStats,
    abuseReports,
    largeTransfers,
    stats: {
      chains:          Object.keys(chainStats).length,
      abuseReports:    abuseReports.length,
      largeTransfers:  largeTransfers.length,
      abuseByChain,
      abuseByCategory,
    },
    fetchedAt: new Date().toISOString(),
  };
}

await runSeed('crypto', 'intel', CANONICAL_KEY, fetchCryptoIntel, {
  ttlSeconds: CACHE_TTL,
  validateFn: (d) => d?.chainStats && d?.stats,
  extraKeys: [{ key: ONCHAIN_KEY, getValue: (d) => ({ chainStats: d.chainStats, stats: d.stats, fetchedAt: d.fetchedAt }) }],
});

verifySeedKey(CANONICAL_KEY);
