import { Router } from 'express';
import { authController } from '../controllers/authController.js';

const router = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RegisterResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: User already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/register', async (req, res, next) => {
  try {
    await authController.register(req, res);
  } catch (error: any) {
    console.error('Route error in /register:', error);
    // Ensure error is properly formatted
    const err = error instanceof Error ? error : new Error(String(error));
    next(err);
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user and get JWT token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login', async (req, res, next) => {
  try {
    await authController.login(req, res);
  } catch (error: any) {
    console.error('Route error in /login:', error);
    // Ensure error is properly formatted
    const err = error instanceof Error ? error : new Error(String(error));
    next(err);
  }
});

/**
 * @swagger
 * /api/auth/instagram:
 *   post:
 *     summary: Instagram sign in or sign up (influencer only)
 *     description: |
 *       Uses an Instagram OAuth user access token. In production, this token should be obtained
 *       through the Instagram OAuth flow (login + consent), not entered manually by end users.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InstagramAuthRequest'
 *     responses:
 *       200:
 *         description: Instagram authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InstagramAuthResponse'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Invalid or expired Instagram token
 *       403:
 *         description: Instagram auth is restricted to influencer accounts
 */
router.post('/instagram', async (req, res, next) => {
  try {
    await authController.instagramAuth(req, res);
  } catch (error: any) {
    console.error('Route error in /instagram:', error);
    const err = error instanceof Error ? error : new Error(String(error));
    next(err);
  }
});

export default router;
