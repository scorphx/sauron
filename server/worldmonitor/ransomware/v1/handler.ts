import type { RansomwareServiceHandler } from '../../../../src/generated/server/worldmonitor/ransomware/v1/service_server';
import { listRansomwareVictims } from './list-ransomware-victims';
export const ransomwareHandler: RansomwareServiceHandler = { listRansomwareVictims };
