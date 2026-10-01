import { Router } from 'express';
import {
  getDashboardMetrics,
  getCustomerStatement,
} from '../controllers/report.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/dashboard-metrics', authenticate, getDashboardMetrics);
router.get('/customer-statement', authenticate, getCustomerStatement);

export default router;
