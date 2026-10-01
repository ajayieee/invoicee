import { Router } from 'express';
import {
  getCompanySettings,
  updateCompanySettings,
  getVatRates,
  getPaymentMethods,
} from '../controllers/settings.controller.js';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/company', authenticate, getCompanySettings);
router.put('/company', authenticate, authorizeRoles('OWNER', 'ACCOUNTANT'), updateCompanySettings);
router.get('/vat-rates', authenticate, getVatRates);
router.get('/payment-methods', authenticate, getPaymentMethods);

export default router;
