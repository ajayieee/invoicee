import { Router } from 'express';
import {
  getCreditNotes,
  getCreditNoteById,
  createCreditNote,
} from '../controllers/creditNote.controller.js';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', authenticate, getCreditNotes);
router.get('/:id', authenticate, getCreditNoteById);
router.post('/', authenticate, authorizeRoles('OWNER', 'ACCOUNTANT'), createCreditNote);

export default router;
