export const config = { runtime: 'edge' };
import { createDomainGateway, serverOptions } from '../../../server/gateway';
import { createBreachServiceRoutes } from '../../../src/generated/server/worldmonitor/breach/v1/service_server';
import { breachHandler } from '../../../server/worldmonitor/breach/v1/handler';
export default createDomainGateway(createBreachServiceRoutes(breachHandler, serverOptions));
