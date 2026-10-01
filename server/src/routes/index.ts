import { Router } from 'express';
import authRoutes from './auth.routes.js';
import invoiceRoutes from './invoice.routes.js';
import paymentRoutes from './payment.routes.js';
import customerRoutes from './customer.routes.js';
import creditNoteRoutes from './creditNote.routes.js';
import quoteRoutes from './quote.routes.js';
import reportRoutes from './report.routes.js';
import settingsRoutes from './settings.routes.js';

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/invoices', invoiceRoutes);
apiRouter.use('/payments', paymentRoutes);
apiRouter.use('/customers', customerRoutes);
apiRouter.use('/credit-notes', creditNoteRoutes);
apiRouter.use('/quotes', quoteRoutes);
apiRouter.use('/reports', reportRoutes);
apiRouter.use('/settings', settingsRoutes);

export default apiRouter;
