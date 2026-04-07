import type { NetworkExposureServiceHandler } from '../../../../src/generated/server/worldmonitor/network-exposure/v1/service_server';
import { listNetworkExposure } from './list-network-exposure';
export const networkExposureHandler: NetworkExposureServiceHandler = { listNetworkExposure };
