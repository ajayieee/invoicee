import { Router } from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/product.controller.js';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', authenticate, getProducts);
router.get('/:id', authenticate, getProductById);
router.post('/', authenticate, authorizeRoles('OWNER', 'ACCOUNTANT', 'SALES'), createProduct);
router.put('/:id', authenticate, authorizeRoles('OWNER', 'ACCOUNTANT', 'SALES'), updateProduct);
router.delete('/:id', authenticate, authorizeRoles('OWNER', 'ACCOUNTANT'), deleteProduct);

export default router;
