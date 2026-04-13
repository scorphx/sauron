// @ts-nocheck
export interface SocialPost { id: string; source: string; sub: string; title: string; url: string; permalink: string; author: string; ups: number; comments: number; score: number; createdMs: number; topics: string[]; }
export interface TrendingTopic { topic: string; count: number; }
export interface SocialPulseStats { totalPosts: number; sourceBreakdown: Record<string, number>; fetchedAt: string; }
export interface ListSocialPostsRequest { pageSize: number; cursor: string; source: string; topic: string; }
export interface ListSocialPostsResponse { posts: SocialPost[]; trending: TrendingTopic[]; stats: SocialPulseStats; pagination: { nextCursor: string; totalCount: number }; fetchedAt: string; }
export interface ServerContext { request: Request; }
export interface ServerOptions { onError?: (error: unknown, req: Request) => Response | Promise<Response>; }
export interface RouteDescriptor { method: string; path: string; handler: (req: Request) => Promise<Response>; }
export interface SocialPulseServiceHandler { listSocialPosts(ctx: ServerContext, req: ListSocialPostsRequest): Promise<ListSocialPostsResponse>; }
function defaultError(err: unknown, _req?: Request): Response { console.error('[social-pulse]', err); return new Response(JSON.stringify({ error: 'internal' }), { status: 500, headers: { 'content-type': 'application/json' } }); }
export function createSocialPulseServiceRoutes(handler: SocialPulseServiceHandler, options?: ServerOptions): RouteDescriptor[] {
  const onError = options?.onError ?? defaultError;
  return [{ method: "GET", path: "/api/social-pulse/v1/list-social-posts",
    handler: async (req: Request): Promise<Response> => {
      try {
        const url = new URL(req.url, 'http://localhost'); const p = url.searchParams;
        const body: ListSocialPostsRequest = { pageSize: Number(p.get('page_size') ?? '50'), cursor: p.get('cursor') ?? '', source: p.get('source') ?? '', topic: p.get('topic') ?? '' };
        const resp = await handler.listSocialPosts({ request: req }, body);
        return new Response(JSON.stringify(resp), { headers: { 'content-type': 'application/json' } });
      } catch (err) { return onError(err, req); }
    },
  }];
}
