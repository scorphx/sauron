export const config = { runtime: 'edge' };
import { createDomainGateway, serverOptions } from '../../../server/gateway';
import { createAiIntelServiceRoutes } from '../../../src/generated/server/worldmonitor/ai-intel/v1/service_server';
import { aiIntelHandler } from '../../../server/worldmonitor/ai-intel/v1/handler';
export default createDomainGateway(createAiIntelServiceRoutes(aiIntelHandler, serverOptions));
