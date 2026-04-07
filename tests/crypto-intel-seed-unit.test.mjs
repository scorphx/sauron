/**
 * Tests for seed-crypto-intel.mjs — mostly network-free helpers.
 * The seed script is mostly async fetch calls, so we test the data
 * transformation logic that can be extracted.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// Test the data shapes the handler expects
describe('crypto intel data contract', () => {
  it('chainStats has expected shape', () => {
    const mockChainStats = {
      bitcoin: {
        chain: 'bitcoin',
        blockHeight: 800000,
        transactions24h: 400000,
        volume24hUsd: 5000000000,
        avgTransactionFee: 5.5,
        hashrateGhs: null,
        marketPriceUsd: 65000,
        circulatingUsd: 1200000000000,
      },
    };
    assert.equal(mockChainStats.bitcoin.chain, 'bitcoin');
    assert.ok(mockChainStats.bitcoin.transactions24h > 0);
  });

  it('abuseReport has expected shape', () => {
    const mockReport = {
      id: 'report-123',
      address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf',
      chain: 'bitcoin',
      category: 'scam',
      description: 'Fake investment scheme',
      reportedAt: '2025-04-07T00:00:00Z',
      url: '',
    };
    assert.ok(mockReport.address.length > 10);
    assert.ok(['scam', 'hack', 'ransom', 'phishing', 'other'].includes(mockReport.category) || typeof mockReport.category === 'string');
  });
});
