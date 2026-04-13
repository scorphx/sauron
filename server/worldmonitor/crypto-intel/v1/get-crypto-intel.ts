import type { ServerContext, GetCryptoIntelRequest, GetCryptoIntelResponse } from '../../../../src/generated/server/worldmonitor/crypto-intel/v1/service_server';
import { getCachedJson } from '../../../_shared/redis';
const SEED_KEY = 'crypto:intel:v1';
export async function getCryptoIntel(_ctx: ServerContext, req: GetCryptoIntelRequest): Promise<GetCryptoIntelResponse> {
  const empty: GetCryptoIntelResponse = { chainStats: {}, abuseReports: [], largeTransfers: [], stats: { chains: 0, abuseReports: 0, largeTransfers: 0, abuseByChain: {}, abuseByCategory: {} }, fetchedAt: '' };
  const seed = await getCachedJson(SEED_KEY, true) as GetCryptoIntelResponse | null;
  if (!seed?.stats) return empty;
  if (req.chain && seed.chainStats) {
    const stat = seed.chainStats[req.chain];
    if (!stat) return { ...seed, chainStats: {} };
    return { ...seed, chainStats: { [req.chain]: stat } };
  }
  return seed;
}
