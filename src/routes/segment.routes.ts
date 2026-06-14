import { Hono } from 'hono';
import * as ctrl from '../controllers/segment.controller.js';

const router = new Hono();

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.post('/preview-rules', ctrl.previewRules);   // preview without saving
router.get('/:id', ctrl.getOne);
router.put('/:id', ctrl.update);
router.get('/:id/preview', ctrl.preview);           // preview with saved segment
router.delete('/:id', ctrl.remove);

export default router;
