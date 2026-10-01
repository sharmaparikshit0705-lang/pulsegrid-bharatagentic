import { Router } from 'express';
import {
  catalog,
  runAgent,
  agentIntents,
  agentSchema,
  runScenario,
  listRuns,
  getRun,
  listApprovals,
  resolveApproval,
  memory,
} from '../controllers/agentsController.js';

const router = Router();

// --- the agent entry point (hosted-agent submission path) ---
router.post('/run-request', runAgent);
router.get('/intents', agentIntents);
router.get('/schema', agentSchema);

router.get('/catalog', catalog);
router.post('/run', runScenario);
router.get('/runs', listRuns);
router.get('/runs/:runId', getRun);
router.get('/approvals', listApprovals);
router.post('/approvals/:id/resolve', resolveApproval);
router.get('/memory', memory);

export default router;
