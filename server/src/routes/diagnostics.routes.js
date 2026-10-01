import { Router } from 'express';
import { citizenReport, edgeScan, listDiagnostics, updateStatus } from '../controllers/diagnosticsController.js';

const router = Router();

router.post('/citizen-report', citizenReport);
router.post('/edge-scan', edgeScan);
router.get('/', listDiagnostics);
router.patch('/:id/status', updateStatus);

export default router;
