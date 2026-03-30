import { Router } from 'express';
import { authenticate, requireAnyRole } from '../middleware/authMiddleware.js';
import { campaignController } from '../controllers/campaignController.js';

const router = Router();

// All routes in this file require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/campaign:
 *   get:
 *     summary: Get all campaigns
 *     description: All authenticated users can view all campaigns
 *     tags: [Campaign]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Campaigns retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Campaigns retrieved successfully
 *                 campaigns:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Campaign'
 *                 count:
 *                   type: integer
 *                   example: 10
 *       401:
 *         description: Unauthorized - Invalid or missing token
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
 *   post:
 *     summary: Create a new campaign
 *     description: Only brands and admins can create campaigns
 *     tags: [Campaign]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCampaignRequest'
 *     responses:
 *       201:
 *         description: Campaign created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateCampaignResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Only brands and admins can create campaigns
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
router.post('/', requireAnyRole('brand', 'admin'), async (req, res, next) => {
  try {
    await campaignController.create(req, res);
  } catch (error: any) {
    console.error('Route error in /campaign:', error);
    // Ensure error is properly formatted
    const err = error instanceof Error ? error : new Error(String(error));
    next(err);
  }
});

/**
 * @swagger
 * /api/campaign/{id}:
 *   get:
 *     summary: Get a campaign by ID
 *     description: All authenticated users can view a specific campaign
 *     tags: [Campaign]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign ID
 *     responses:
 *       200:
 *         description: Campaign retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Campaign retrieved successfully
 *                 campaign:
 *                   $ref: '#/components/schemas/Campaign'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Campaign not found
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
router.get('/', async (req, res, next) => {
  try {
    await campaignController.getAll(req, res);
  } catch (error: any) {
    console.error('Route error in /campaign:', error);
    const err = error instanceof Error ? error : new Error(String(error));
    next(err);
  }
});

/**
 * @swagger
 * /api/campaign/mine:
 *   get:
 *     summary: Get my campaigns (brand / admin)
 *     description: Lists only campaigns owned by the authenticated user (same full Campaign shape as other list endpoints). Brand and admin only; use GET /api/campaign for all campaigns or /user/{userId} as admin for another owner.
 *     tags: [Campaign]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Campaigns retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 count:
 *                   type: integer
 *                 campaigns:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Campaign'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — not a brand or admin
 */
router.get('/mine', requireAnyRole('brand', 'admin'), async (req, res, next) => {
  try {
    await campaignController.getMine(req, res);
  } catch (error: any) {
    console.error('Route error in /campaign/mine:', error);
    const err = error instanceof Error ? error : new Error(String(error));
    next(err);
  }
});

/**
 * @swagger
 * /api/campaign/user/{userId}:
 *   get:
 *     summary: Get campaigns by owner user id
 *     description: Admin can list any user's campaigns. Other roles only their own userId.
 *     tags: [Campaign]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign owner (user) id
 *     responses:
 *       200:
 *         description: Campaigns retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 userId:
 *                   type: string
 *                 count:
 *                   type: integer
 *                 campaigns:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Campaign'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — cannot view another user's campaigns
 */
router.get('/user/:userId', async (req, res, next) => {
  try {
    await campaignController.getByUserId(req, res);
  } catch (error: any) {
    console.error('Route error in /campaign/user/:userId:', error);
    const err = error instanceof Error ? error : new Error(String(error));
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    await campaignController.getById(req, res);
  } catch (error: any) {
    console.error('Route error in /campaign/:id:', error);
    const err = error instanceof Error ? error : new Error(String(error));
    next(err);
  }
});

export default router;
