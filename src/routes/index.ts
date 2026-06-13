import { Hono } from 'hono';
import customerRoutes from './customer.routes.js';
import segmentRoutes from './segment.routes.js';
import campaignRoutes from './campaign.routes.js';
import receiptRoutes from './receipt.routes.js';
import aiRoutes from './ai.routes.js';
import dashboardRoutes from './dashboard.routes.js';

const api = new Hono();

api.route('/customers', customerRoutes);
api.route('/segments', segmentRoutes);
api.route('/campaigns', campaignRoutes);
api.route('/receipts', receiptRoutes);
api.route('/ai', aiRoutes);
api.route('/dashboard', dashboardRoutes);

// Health check
api.get('/health', (c) =>
  c.json({ status: 'ok', timestamp: new Date().toISOString() })
);

export default api;
