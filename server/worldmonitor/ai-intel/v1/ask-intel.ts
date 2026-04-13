import { callLlmTool } from '../../../_shared/llm';
import type { AskIntelRequest, AskIntelResponse, IntelAction } from '../../../../src/generated/server/worldmonitor/ai-intel/v1/service_server';

const SYSTEM = `You are a geopolitical intelligence analyst for a real-time global situational awareness platform.
Given a user query, respond with a JSON object only — no prose outside JSON:

{
  "summary": "<2-3 sentence intelligence briefing, direct and precise>",
  "actions": [
    // optional array — include only what is clearly implied by the query
    { "type": "zoom", "payload": { "lat": <number>, "lng": <number>, "altitude": <0.5–2.0> } },
    { "type": "layer_on",  "payload": { "layer": "<name>" } },
    { "type": "layer_off", "payload": { "layer": "<name>" } }
  ]
}

Available layers: conflicts, military, nuclear, iran, radiation, spaceports, cables, ais, flights
altitude guide: 0.5=country, 1.0=region, 1.5=continent, 2.0=global
Return valid JSON only. No markdown, no code fences.`;

export async function askIntel(req: AskIntelRequest): Promise<AskIntelResponse> {
  const empty: AskIntelResponse = {
    summary: 'Intelligence analysis unavailable. No LLM provider configured.',
    actions: [],
    fetchedAt: new Date().toISOString(),
  };

  const result = await callLlmTool({
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `Query: ${req.query}${req.region && req.region !== 'global' ? `\nCurrent focus region: ${req.region}` : ''}`,
      },
    ],
    temperature: 0.15,
    maxTokens: 420,
    validate: (c) => {
      try {
        const p = JSON.parse(c) as unknown;
        return typeof (p as Record<string, unknown>).summary === 'string';
      } catch {
        return false;
      }
    },
  });

  if (!result) return empty;

  try {
    const parsed = JSON.parse(result.content) as {
      summary?: string;
      actions?: IntelAction[];
    };
    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary : empty.summary,
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return empty;
  }
}
