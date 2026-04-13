// @ts-nocheck
// Generated types for breach/v1 service. DO NOT EDIT.

export interface Breach {
  name: string; domain: string; title: string; breachDate: string; addedDate: string;
  pwnCount: number; dataClasses: string[]; categories: string[]; isVerified: boolean;
  isFabricated: boolean; isSensitive: boolean; isSpamList: boolean; isMalware: boolean;
  isSubscription: boolean; severity: string;
}

export interface BreachStats {
  totalBreaches: number; totalPwnedCount: number;
  bySeverity: Record<string, number>; byCategory: Record<string, number>; byYear: Record<string, number>;
}

export interface ListBreachesRequest { pageSize: number; cursor: string; severity: string; category: string; sinceDate: string; }
export interface ListBreachesResponse { breaches: Breach[]; recentBreaches: Breach[]; stats: BreachStats; pagination: { nextCursor: string; totalCount: number }; fetchedAt: string; }

export interface ServerContext { request: Request; }
export interface ServerOptions { onError?: (error: unknown, req: Request) => Response | Promise<Response>; }
export interface RouteDescriptor { method: string; path: string; handler: (req: Request) => Promise<Response>; }

export interface BreachServiceHandler {
  listBreaches(ctx: ServerContext, req: ListBreachesRequest): Promise<ListBreachesResponse>;
}

function defaultError(err: unknown, _req?: Request): Response {
  console.error('[breach]', err);
  return new Response(JSON.stringify({ error: 'internal' }), { status: 500, headers: { 'content-type': 'application/json' } });
}

export function createBreachServiceRoutes(handler: BreachServiceHandler, options?: ServerOptions): RouteDescriptor[] {
  const onError = options?.onError ?? defaultError;
  return [{
    method: "GET", path: "/api/breach/v1/list-breaches",
    handler: async (req: Request): Promise<Response> => {
      try {
        const url = new URL(req.url, 'http://localhost'); const p = url.searchParams;
        const body: ListBreachesRequest = { pageSize: Number(p.get('page_size') ?? '50'), cursor: p.get('cursor') ?? '', severity: p.get('severity') ?? '', category: p.get('category') ?? '', sinceDate: p.get('since_date') ?? '' };
        const resp = await handler.listBreaches({ request: req }, body);
        return new Response(JSON.stringify(resp), { headers: { 'content-type': 'application/json' } });
      } catch (err) { return onError(err, req); }
    },
  }];
}
