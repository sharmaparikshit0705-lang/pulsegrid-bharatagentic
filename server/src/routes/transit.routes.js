import { Router } from 'express';
import {
  getFleet,
  greenLaneViolations,
  greenLaneSweep,
  recalculateCapacity,
  dispatchBus,
} from '../controllers/transitController.js';

const router = Router();

router.get('/fleet', getFleet);
router.get('/green-lane-violations', greenLaneViolations);
router.post('/green-lane-sweep', greenLaneSweep);
router.post('/fleet/:busId/recalculate-capacity', recalculateCapacity);
router.post('/fleet/:busId/dispatch', dispatchBus);

export default router;
