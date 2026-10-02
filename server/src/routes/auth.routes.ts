import { Router } from 'express';
import {
  login,
  register,
  getMe,
  getUsers,
  updateUserRole,
  getSetupStatus,
  setupInitialAdmin,
} from '../controllers/auth.controller.js';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/setup-status', getSetupStatus);
router.post('/setup-admin', setupInitialAdmin);
router.post('/login', login);
router.post('/register', authenticate, authorizeRoles('OWNER'), register);
router.get('/me', authenticate, getMe);
router.get('/users', authenticate, getUsers);
router.patch('/users/:id/role', authenticate, authorizeRoles('OWNER'), updateUserRole);

export default router;
