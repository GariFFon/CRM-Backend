import { Hono } from 'hono';
import * as ctrl from '../controllers/campaign.controller.js';

const router = new Hono();

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getOne);
router.post('/:id/launch', ctrl.launch);
router.get('/:id/stats', ctrl.getStats);
router.get('/:id/messages', ctrl.getMessages);

export default router;
