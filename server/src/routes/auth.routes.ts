import { Router } from 'express';
import {
  login,
  register,
  getMe,
  getSetupStatus,
  setupInitialAdmin,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/setup-status', getSetupStatus);
router.post('/setup-admin', setupInitialAdmin);
router.post('/login', login);
router.post('/register', register);
router.get('/me', authenticate, getMe);

export default router;
