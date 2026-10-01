import { Router } from 'express';
import {
  listSignals,
  adaptiveStatus,
  extendGreen,
  cyclePhase,
  emergencyOverride,
} from '../controllers/signalsController.js';

const router = Router();

router.get('/', listSignals);
router.get('/adaptive-status/:junctionId', adaptiveStatus);
router.post('/emergency-override', emergencyOverride);
router.post('/:junctionId/extend-green', extendGreen);
router.post('/:junctionId/cycle-phase', cyclePhase);

export default router;
