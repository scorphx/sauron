import type { AiIntelServiceHandler } from '../../../../src/generated/server/worldmonitor/ai-intel/v1/service_server';
import { askIntel } from './ask-intel';

export const aiIntelHandler: AiIntelServiceHandler = {
  askIntel: (_ctx, req) => askIntel(req),
};
