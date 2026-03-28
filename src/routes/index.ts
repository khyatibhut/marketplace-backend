import { Router } from 'express';
import authRoutes from './auth.routes';
import productRoutes from './product.routes';
import orderRoutes from './order.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/orders', orderRoutes);

// Health check endpoint mapping
router.get('/ping', (req, res) => res.status(200).json({ status: 'live' }));

export default router;
