import { Router } from 'express';
import {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateDraftInvoice,
  issueInvoice,
  duplicateInvoice,
  cancelInvoice,
} from '../controllers/invoice.controller.js';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', authenticate, getInvoices);
router.get('/:id', authenticate, getInvoiceById);
router.post('/', authenticate, authorizeRoles('OWNER', 'ACCOUNTANT', 'SALES'), createInvoice);
router.put('/:id', authenticate, authorizeRoles('OWNER', 'ACCOUNTANT', 'SALES'), updateDraftInvoice);
router.post('/:id/issue', authenticate, authorizeRoles('OWNER', 'ACCOUNTANT'), issueInvoice);
router.post('/:id/duplicate', authenticate, authorizeRoles('OWNER', 'ACCOUNTANT', 'SALES'), duplicateInvoice);
router.post('/:id/cancel', authenticate, authorizeRoles('OWNER', 'ACCOUNTANT'), cancelInvoice);

export default router;
