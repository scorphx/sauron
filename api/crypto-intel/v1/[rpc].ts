export const config = { runtime: 'edge' };
import { createDomainGateway, serverOptions } from '../../../server/gateway';
import { createCryptoIntelServiceRoutes } from '../../../src/generated/server/worldmonitor/crypto-intel/v1/service_server';
import { cryptoIntelHandler } from '../../../server/worldmonitor/crypto-intel/v1/handler';
export default createDomainGateway(createCryptoIntelServiceRoutes(cryptoIntelHandler, serverOptions));
