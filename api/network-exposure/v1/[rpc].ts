export const config = { runtime: 'edge' };
import { createDomainGateway, serverOptions } from '../../../server/gateway';
import { createNetworkExposureServiceRoutes } from '../../../src/generated/server/worldmonitor/network-exposure/v1/service_server';
import { networkExposureHandler } from '../../../server/worldmonitor/network-exposure/v1/handler';
export default createDomainGateway(createNetworkExposureServiceRoutes(networkExposureHandler, serverOptions));
