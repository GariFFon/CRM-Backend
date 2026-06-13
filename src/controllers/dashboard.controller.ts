import type { Context } from 'hono';
import { getDashboardData } from '../services/dashboard.service.js';

export async function getDashboard(c: Context) {
  const data = await getDashboardData();
  return c.json({ success: true, data });
}
