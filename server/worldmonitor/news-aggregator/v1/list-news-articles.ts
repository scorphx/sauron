import type { ServerContext, ListNewsArticlesRequest, ListNewsArticlesResponse } from '../../../../src/generated/server/worldmonitor/news-aggregator/v1/service_server';
import { getCachedJson } from '../../../_shared/redis';
const SEED_KEY = 'news:headlines:v1';
export async function listNewsArticles(_ctx: ServerContext, req: ListNewsArticlesRequest): Promise<ListNewsArticlesResponse> {
  const empty: ListNewsArticlesResponse = { articles: [], stats: { totalArticles: 0, sourceBreakdown: {} }, pagination: { nextCursor: '', totalCount: 0 }, fetchedAt: '' };
  const seed = await getCachedJson(SEED_KEY, true) as ListNewsArticlesResponse | null;
  if (!seed?.articles?.length) return empty;
  let articles = seed.articles;
  if (req.source) articles = articles.filter((a) => a.source === req.source);
  const pageSize = Math.min(Math.max(req.pageSize || 50, 1), 200);
  const offset   = req.cursor ? parseInt(req.cursor, 10) || 0 : 0;
  const page     = articles.slice(offset, offset + pageSize);
  const next     = offset + pageSize < articles.length ? String(offset + pageSize) : '';
  return { articles: page, stats: seed.stats || empty.stats, pagination: { nextCursor: next, totalCount: articles.length }, fetchedAt: seed.fetchedAt || '' };
}
