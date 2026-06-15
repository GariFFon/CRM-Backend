import { Hono } from 'hono';
import * as ctrl from '../controllers/ai.controller.js';

const router = new Hono();

router.post('/segment', ctrl.generateSegment);              // NL → segment rules
router.post('/copy', ctrl.generateCopy);                    // goal + segment → message copy
router.post('/channel', ctrl.recommendChannel);             // segment → channel recommendation
router.post('/insights', ctrl.generateInsights);            // campaign → insights summary
router.post('/pre-launch-insights', ctrl.preLaunchInsights); // pre-launch risk signal

export default router;
