export const config = { runtime: 'edge' };
import { createDomainGateway, serverOptions } from '../../../server/gateway';
import { createNewsAggregatorServiceRoutes } from '../../../src/generated/server/worldmonitor/news-aggregator/v1/service_server';
import { newsAggregatorHandler } from '../../../server/worldmonitor/news-aggregator/v1/handler';
export default createDomainGateway(createNewsAggregatorServiceRoutes(newsAggregatorHandler, serverOptions));
