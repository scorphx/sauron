// @ts-nocheck
export interface NewsArticle { id: string; source: string; sourceLabel: string; bias: string; title: string; url: string; summary: string; publishedMs: number; publishedAt: string; }
export interface NewsStats { totalArticles: number; sourceBreakdown: Record<string, number>; }
export interface ListNewsArticlesRequest { pageSize: number; cursor: string; source: string; }
export interface ListNewsArticlesResponse { articles: NewsArticle[]; stats: NewsStats; pagination: { nextCursor: string; totalCount: number }; fetchedAt: string; }
export interface ServerContext { request: Request; }
export interface ServerOptions { onError?: (err: unknown) => Response; }
export interface RouteDescriptor { method: string; path: string; handler: (req: Request) => Promise<Response>; }
export interface NewsAggregatorServiceHandler { listNewsArticles(ctx: ServerContext, req: ListNewsArticlesRequest): Promise<ListNewsArticlesResponse>; }
function defaultError(err: unknown): Response { console.error('[news-aggregator]', err); return new Response(JSON.stringify({ error: 'internal' }), { status: 500, headers: { 'content-type': 'application/json' } }); }
export function createNewsAggregatorServiceRoutes(handler: NewsAggregatorServiceHandler, options?: ServerOptions): RouteDescriptor[] {
  const onError = options?.onError ?? defaultError;
  return [{ method: "GET", path: "/api/news-aggregator/v1/list-news-articles",
    handler: async (req: Request): Promise<Response> => {
      try {
        const url = new URL(req.url, 'http://localhost'); const p = url.searchParams;
        const body: ListNewsArticlesRequest = { pageSize: Number(p.get('page_size') ?? '50'), cursor: p.get('cursor') ?? '', source: p.get('source') ?? '' };
        const resp = await handler.listNewsArticles({ request: req }, body);
        return new Response(JSON.stringify(resp), { headers: { 'content-type': 'application/json' } });
      } catch (err) { return onError(err); }
    },
  }];
}
