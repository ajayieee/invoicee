import { Router } from 'express';
import {
  getCustomers,
  getCustomerById,
  getCustomer360,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../controllers/customer.controller.js';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', authenticate, getCustomers);
router.get('/:id', authenticate, getCustomerById);
router.get('/:id/360', authenticate, getCustomer360);
router.post('/', authenticate, authorizeRoles('OWNER', 'ACCOUNTANT', 'SALES'), createCustomer);
router.put('/:id', authenticate, authorizeRoles('OWNER', 'ACCOUNTANT', 'SALES'), updateCustomer);
router.delete('/:id', authenticate, authorizeRoles('OWNER', 'ACCOUNTANT'), deleteCustomer);

export default router;
