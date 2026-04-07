export const config = { runtime: 'edge' };
import { createDomainGateway, serverOptions } from '../../../server/gateway';
import { createRansomwareServiceRoutes } from '../../../src/generated/server/worldmonitor/ransomware/v1/service_server';
import { ransomwareHandler } from '../../../server/worldmonitor/ransomware/v1/handler';
export default createDomainGateway(createRansomwareServiceRoutes(ransomwareHandler, serverOptions));
