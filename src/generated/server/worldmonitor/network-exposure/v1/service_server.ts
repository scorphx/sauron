// @ts-nocheck
export interface PhishEntry { id: string; url: string; submittedAt: string; verified: boolean; online: boolean; target: string; }
export interface AbuseIPEntry { ip: string; countryCode: string; abuseScore: number; totalReports: number; lastReportedAt: string; isp: string; usageType: string; }
export interface C2Server { ip: string; port: number; malware: string; firstSeen: string; lastOnline: string; country: string; }
export interface NetworkExposureStats { phishingUrls: number; abuseIPs: number; c2IPs: number; }
export interface ListNetworkExposureRequest { pageSize: number; cursor: string; type: string; }
export interface ListNetworkExposureResponse { phishing: { entries: PhishEntry[]; topTargets: { target: string; count: number }[]; totalCount: number }; abuseIPs: { entries: AbuseIPEntry[]; byCountry: Record<string, number>; totalCount: number }; c2Servers: { entries: C2Server[]; totalCount: number }; stats: NetworkExposureStats; pagination: { nextCursor: string; totalCount: number }; fetchedAt: string; }
export interface ServerContext { request: Request; }
export interface ServerOptions { onError?: (err: unknown) => Response; }
export interface RouteDescriptor { method: string; path: string; handler: (req: Request) => Promise<Response>; }
export interface NetworkExposureServiceHandler { listNetworkExposure(ctx: ServerContext, req: ListNetworkExposureRequest): Promise<ListNetworkExposureResponse>; }
function defaultError(err: unknown): Response { console.error('[network-exposure]', err); return new Response(JSON.stringify({ error: 'internal' }), { status: 500, headers: { 'content-type': 'application/json' } }); }
export function createNetworkExposureServiceRoutes(handler: NetworkExposureServiceHandler, options?: ServerOptions): RouteDescriptor[] {
  const onError = options?.onError ?? defaultError;
  return [{ method: "GET", path: "/api/network-exposure/v1/list-network-exposure",
    handler: async (req: Request): Promise<Response> => {
      try {
        const url = new URL(req.url, 'http://localhost'); const p = url.searchParams;
        const body: ListNetworkExposureRequest = { pageSize: Number(p.get('page_size') ?? '50'), cursor: p.get('cursor') ?? '', type: p.get('type') ?? '' };
        const resp = await handler.listNetworkExposure({ request: req }, body);
        return new Response(JSON.stringify(resp), { headers: { 'content-type': 'application/json' } });
      } catch (err) { return onError(err); }
    },
  }];
}
