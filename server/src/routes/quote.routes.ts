import { Router } from 'express';
import {
  getQuotes,
  getQuoteById,
  createQuote,
  convertQuoteToInvoice,
} from '../controllers/quote.controller.js';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', authenticate, getQuotes);
router.get('/:id', authenticate, getQuoteById);
router.post('/', authenticate, authorizeRoles('OWNER', 'ACCOUNTANT', 'SALES'), createQuote);
router.post('/:id/convert', authenticate, authorizeRoles('OWNER', 'ACCOUNTANT', 'SALES'), convertQuoteToInvoice);

export default router;
