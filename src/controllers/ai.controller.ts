import type { Context } from 'hono';
import * as aiService from '../services/ai.service.js';

export async function generateSegment(c: Context) {
  const { query } = await c.req.json<{ query: string }>();
  if (!query?.trim()) {
    return c.json({ success: false, error: 'query is required' }, 400);
  }
  const result = await aiService.aiGenerateSegmentRules(query);
  return c.json({ success: true, data: result });
}

export async function generateCopy(c: Context) {
  const body = await c.req.json<{
    campaignGoal: string;
    segmentId: string;
    channel: string;
  }>();
  const variants = await aiService.aiGenerateCopy(body);
  return c.json({ success: true, data: variants });
}

export async function recommendChannel(c: Context) {
  const { segmentId } = await c.req.json<{ segmentId: string }>();
  const result = await aiService.aiRecommendChannel(segmentId);
  return c.json({ success: true, data: result });
}

export async function generateInsights(c: Context) {
  const { campaignId } = await c.req.json<{ campaignId: string }>();
  const insights = await aiService.aiGenerateInsights(campaignId);
  return c.json({ success: true, data: { insights } });
}

export async function preLaunchInsights(c: Context) {
  const { segmentId, channel } = await c.req.json<{ segmentId: string; channel: string }>();
  if (!segmentId?.trim() || !channel?.trim()) {
    return c.json({ success: false, error: 'segmentId and channel are required' }, 400);
  }
  const insights = await aiService.aiPreLaunchInsights({ segmentId, channel });
  return c.json({ success: true, data: insights });
}
