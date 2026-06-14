import { Hono } from 'hono';
import { send, getInbox, openMessage, clickMessage } from './channel.controller.js';

const channelRouter = new Hono();

// POST /channel/send — our messaging provider receive endpoint
channelRouter.post('/send', send);

// ─── Provider Inbox API ───────────────────────────────────────────────────────

// GET /channel/inbox — list all messages from live-mode campaigns
channelRouter.get('/inbox', getInbox);

// POST /channel/inbox/:id/open — user opened a message
channelRouter.post('/inbox/:id/open', openMessage);

// POST /channel/inbox/:id/click — user clicked the CTA link
channelRouter.post('/inbox/:id/click', clickMessage);

// Health check
channelRouter.get('/health', (c) =>
  c.json({
    status: 'ok',
    service: 'channel-stub',
    channels: ['whatsapp', 'sms', 'email', 'rcs'],
    modes: ['simulate', 'live'],
    timestamp: new Date().toISOString(),
  })
);

export default channelRouter;
