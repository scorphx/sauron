// @ts-nocheck
// Generated types for ransomware/v1 service. DO NOT EDIT.

export interface RansomwareVictim {
  id: string;
  victimName: string;
  groupName: string;
  url: string;
  discoveredAt: string;
  discoveredMs: number;
  sector: string;
  website: string;
  country: string;
  description: string;
}

export interface RansomwareGroup {
  name: string;
  postCount: number;
  captureDate: string;
  locationCount: number;
}

export interface RansomwareStats {
  totalVictims: number;
  activeGroups: number;
  sectorBreakdown: Record<string, number>;
  last24hCount: number;
  last7dCount: number;
}

export interface ListRansomwareVictimsRequest {
  pageSize: number;
  cursor: string;
  groupName: string;
  sector: string;
  country: string;
  sinceMs: number;
}

export interface ListRansomwareVictimsResponse {
  victims: RansomwareVictim[];
  groups: RansomwareGroup[];
  stats: RansomwareStats;
  pagination: { nextCursor: string; totalCount: number };
  fetchedAt: string;
}

export interface ServerContext { request: Request; }
export interface ServerOptions { onError?: (error: unknown, req: Request) => Response | Promise<Response>; }
export interface RouteDescriptor { method: string; path: string; handler: (req: Request) => Promise<Response>; }

export interface RansomwareServiceHandler {
  listRansomwareVictims(ctx: ServerContext, req: ListRansomwareVictimsRequest): Promise<ListRansomwareVictimsResponse>;
}

function defaultError(err: unknown, _req?: Request): Response {
  console.error('[ransomware]', err);
  return new Response(JSON.stringify({ error: 'internal' }), { status: 500, headers: { 'content-type': 'application/json' } });
}

export function createRansomwareServiceRoutes(handler: RansomwareServiceHandler, options?: ServerOptions): RouteDescriptor[] {
  const onError = options?.onError ?? defaultError;
  return [
    {
      method: "GET",
      path: "/api/ransomware/v1/list-ransomware-victims",
      handler: async (req: Request): Promise<Response> => {
        try {
          const ctx: ServerContext = { request: req };
          const url = new URL(req.url, 'http://localhost');
          const p = url.searchParams;
          const body: ListRansomwareVictimsRequest = {
            pageSize:  Number(p.get('page_size') ?? '50'),
            cursor:    p.get('cursor') ?? '',
            groupName: p.get('group_name') ?? '',
            sector:    p.get('sector') ?? '',
            country:   p.get('country') ?? '',
            sinceMs:   Number(p.get('since_ms') ?? '0'),
          };
          const resp = await handler.listRansomwareVictims(ctx, body);
          return new Response(JSON.stringify(resp), { headers: { 'content-type': 'application/json' } });
        } catch (err) { return onError(err, req); }
      },
    },
  ];
}
