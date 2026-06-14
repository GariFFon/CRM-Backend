import 'dotenv/config';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';

// Middleware
import { corsMiddleware } from './middleware/cors.js';
import { logger } from './middleware/logger.js';
import { errorHandler } from './middleware/errorHandler.js';

// Routes
import apiRoutes from './routes/index.js';
import channelRoutes from './channel/channel.routes.js';

// Queue worker
import { startSendWorker } from './queues/sendQueue.js';

// ─── App ─────────────────────────────────────────────────────────────────────

const app = new Hono();

// ─── Global Middleware ────────────────────────────────────────────────────────

app.use('*', corsMiddleware);
app.use('*', logger);

// ─── Routes ──────────────────────────────────────────────────────────────────

// CRM API routes — all under /api prefix
app.route('/api', apiRoutes);

// Channel stub routes — our own messaging provider
app.route('/channel', channelRoutes);

// Root health check
app.get('/', (c) =>
  c.json({
    name: 'Xeno Mini CRM — Backend',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      api: '/api',
      channel: '/channel',
      health: '/api/health',
    },
  })
);

// ─── Error Handler ────────────────────────────────────────────────────────────

app.onError(errorHandler);

// 404 handler
app.notFound((c) =>
  c.json({ success: false, error: `Route ${c.req.path} not found` }, 404)
);

// ─── Start Server ─────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3001');

// Start in-process send worker
startSendWorker();

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║       Xeno Mini CRM — Backend Server         ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  🚀 Server:  http://localhost:${PORT}           ║`);
  console.log(`║  📊 API:     http://localhost:${PORT}/api        ║`);
  console.log(`║  📡 Channel: http://localhost:${PORT}/channel    ║`);
  console.log(`║  🌍 Env:     ${(process.env.NODE_ENV ?? 'development').padEnd(32)}║`);
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
});
