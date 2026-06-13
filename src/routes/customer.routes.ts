import { Hono } from 'hono';
import * as ctrl from '../controllers/customer.controller.js';

const router = new Hono();

router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);

export default router;
