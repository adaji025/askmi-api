import { Router } from 'express';
import { authController } from '../controllers/authController.js';

const router = Router();

// POST /api/auth/register
router.post('/register', (req, res) => authController.register(req, res));

// POST /api/auth/login
router.post('/login', (req, res) => authController.login(req, res));

export default router;
