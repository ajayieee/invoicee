import { Router } from 'express';
import {
  getPayments,
  recordPayment,
  reversePayment,
} from '../controllers/payment.controller.js';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', authenticate, getPayments);
router.post('/', authenticate, authorizeRoles('OWNER', 'ACCOUNTANT'), recordPayment);
router.post('/:id/reverse', authenticate, authorizeRoles('OWNER', 'ACCOUNTANT'), reversePayment);

export default router;
