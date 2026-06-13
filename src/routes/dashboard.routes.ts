import { Hono } from 'hono';
import * as ctrl from '../controllers/dashboard.controller.js';

const router = new Hono();

router.get('/', ctrl.getDashboard);

export default router;
