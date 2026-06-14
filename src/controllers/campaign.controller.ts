import type { Context } from 'hono';
import * as campaignService from '../services/campaign.service.js';
import * as statsService from '../services/stats.service.js';

export async function list(c: Context) {
  const data = await campaignService.getAllCampaigns();
  return c.json({ success: true, data });
}

export async function create(c: Context) {
  const body = await c.req.json<{
    name: string;
    segmentId: string;
    channel: 'whatsapp' | 'sms' | 'email' | 'rcs';
    messageTemplate: string;
    deliveryMode?: 'simulate' | 'live';
  }>();

  const campaign = await campaignService.createCampaign(body);
  return c.json({ success: true, data: campaign }, 201);
}

export async function getOne(c: Context) {
  const id = c.req.param('id')!;
  const campaign = await campaignService.getCampaignById(id);
  return c.json({ success: true, data: campaign });
}

export async function remove(c: Context) {
  const id = c.req.param('id')!;
  await campaignService.deleteCampaign(id);
  return c.json({ success: true, message: 'Campaign deleted' });
}

export async function launch(c: Context) {
  const id = c.req.param('id')!;
  const result = await campaignService.launchCampaign(id);
  return c.json({ success: true, data: result }, 202);
}

export async function retry(c: Context) {
  const id = c.req.param('id')!;
  const result = await campaignService.retryCampaign(id);
  return c.json({ success: true, data: result }, 202);
}

export async function getStats(c: Context) {
  const id = c.req.param('id')!;
  const stats = await statsService.getCampaignStats(id);
  return c.json({ success: true, data: stats });
}

export async function getMessages(c: Context) {
  const id = c.req.param('id')!;
  const limit = parseInt(c.req.query('limit') ?? '100');
  const msgs = await statsService.getCampaignMessages(id, limit);
  return c.json({ success: true, data: msgs });
}
