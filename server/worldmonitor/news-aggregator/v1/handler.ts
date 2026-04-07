import type { NewsAggregatorServiceHandler } from '../../../../src/generated/server/worldmonitor/news-aggregator/v1/service_server';
import { listNewsArticles } from './list-news-articles';
export const newsAggregatorHandler: NewsAggregatorServiceHandler = { listNewsArticles };
