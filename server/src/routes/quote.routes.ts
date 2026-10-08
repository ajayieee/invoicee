import { Router } from 'express';
import {
  getQuotes,
  getQuoteById,
  createQuote,
  updateQuote,
  updateQuoteStatus,
  convertQuoteToInvoice,
  deleteQuote,
} from '../controllers/quote.controller.js';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', authenticate, getQuotes);
router.get('/:id', authenticate, getQuoteById);
router.post('/', authenticate, authorizeRoles('OWNER', 'ACCOUNTANT', 'SALES'), createQuote);
router.put('/:id', authenticate, authorizeRoles('OWNER', 'ACCOUNTANT', 'SALES'), updateQuote);
router.patch('/:id/status', authenticate, authorizeRoles('OWNER', 'ACCOUNTANT', 'SALES'), updateQuoteStatus);
router.put('/:id/status', authenticate, authorizeRoles('OWNER', 'ACCOUNTANT', 'SALES'), updateQuoteStatus);
router.post('/:id/convert', authenticate, authorizeRoles('OWNER', 'ACCOUNTANT', 'SALES'), convertQuoteToInvoice);
router.delete('/:id', authenticate, authorizeRoles('OWNER', 'ADMIN'), deleteQuote);

export default router;
