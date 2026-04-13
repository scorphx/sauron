// @ts-nocheck
export interface ChainStats { chain: string; blockHeight: number; transactions24h: number; volume24hUsd: number; avgTransactionFee: number; hashrateGhs: number | null; mempoolSize: number | null; marketPriceUsd: number | null; circulatingUsd: number | null; }
export interface CryptoAbuseReport { id: string; address: string; chain: string; category: string; description: string; reportedAt: string; url: string; }
export interface LargeTransfer { hash: string; from: string; to: string; value: number; token: string; timeStamp: number; blockNumber: number; }
export interface CryptoIntelStats { chains: number; abuseReports: number; largeTransfers: number; abuseByChain: Record<string, number>; abuseByCategory: Record<string, number>; }
export interface GetCryptoIntelRequest { chain: string; }
export interface GetCryptoIntelResponse { chainStats: Record<string, ChainStats>; abuseReports: CryptoAbuseReport[]; largeTransfers: LargeTransfer[]; stats: CryptoIntelStats; fetchedAt: string; }
export interface ServerContext { request: Request; }
export interface ServerOptions { onError?: (error: unknown, req: Request) => Response | Promise<Response>; }
export interface RouteDescriptor { method: string; path: string; handler: (req: Request) => Promise<Response>; }
export interface CryptoIntelServiceHandler { getCryptoIntel(ctx: ServerContext, req: GetCryptoIntelRequest): Promise<GetCryptoIntelResponse>; }
function defaultError(err: unknown, _req?: Request): Response { console.error('[crypto-intel]', err); return new Response(JSON.stringify({ error: 'internal' }), { status: 500, headers: { 'content-type': 'application/json' } }); }
export function createCryptoIntelServiceRoutes(handler: CryptoIntelServiceHandler, options?: ServerOptions): RouteDescriptor[] {
  const onError = options?.onError ?? defaultError;
  return [{ method: "GET", path: "/api/crypto-intel/v1/get-crypto-intel",
    handler: async (req: Request): Promise<Response> => {
      try {
        const url = new URL(req.url, 'http://localhost'); const p = url.searchParams;
        const body: GetCryptoIntelRequest = { chain: p.get('chain') ?? '' };
        const resp = await handler.getCryptoIntel({ request: req }, body);
        return new Response(JSON.stringify(resp), { headers: { 'content-type': 'application/json' } });
      } catch (err) { return onError(err, req); }
    },
  }];
}
