import { Hono } from 'hono';
import * as ctrl from '../controllers/receipt.controller.js';

const router = new Hono();

// This is the callback endpoint — called by our channel stub
router.post('/', ctrl.handleReceipt);

export default router;
