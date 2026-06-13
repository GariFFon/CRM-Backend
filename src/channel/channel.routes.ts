import { Hono } from 'hono';
import { send } from './channel.controller.js';

const channelRouter = new Hono();

// POST /channel/send — our own messaging provider endpoint
channelRouter.post('/send', send);

// Health check for the channel stub
channelRouter.get('/health', (c) =>
  c.json({
    status: 'ok',
    service: 'channel-stub',
    channels: ['whatsapp', 'sms', 'email', 'rcs'],
    timestamp: new Date().toISOString(),
  })
);

export default channelRouter;
