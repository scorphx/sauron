import type { CryptoIntelServiceHandler } from '../../../../src/generated/server/worldmonitor/crypto-intel/v1/service_server';
import { getCryptoIntel } from './get-crypto-intel';
export const cryptoIntelHandler: CryptoIntelServiceHandler = { getCryptoIntel };
