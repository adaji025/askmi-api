import { Router } from 'express';
import { authenticate, requireAnyRole } from '../middleware/authMiddleware.js';
import { budgetController } from '../controllers/budgetController.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/budget/estimate:
 *   get:
 *     summary: Get budget estimate
 *     description: |
 *       Calculates budget using formula Budget = Total Questions × Total Desired Votes.
 *       Applies a fixed ±20% deviation range.
 *       Does not require role restriction - all authenticated users can estimate.
 *     tags: [Budget]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: totalQuestions
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Total number of questions
 *       - in: query
 *         name: desiredVote
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Total desired votes
 *     responses:
 *       200:
 *         description: Budget estimate calculated successfully
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
 *                 estimate:
 *                   type: object
 *                   properties:
 *                     baseBudget:
 *                       type: number
 *                       description: Total Questions × Total Desired Votes
 *                     minBudget:
 *                       type: number
 *                       description: baseBudget × 0.8
 *                     maxBudget:
 *                       type: number
 *                       description: baseBudget × 1.2
 *                     totalQuestions:
 *                       type: integer
 *                     desiredVote:
 *                       type: integer
 *                     deviationPercent:
 *                       type: number
 *                       example: 20
 *       400:
 *         description: Validation error - totalQuestions and desiredVote required
 *       401:
 *         description: Unauthorized
 */
router.get('/estimate', async (req, res, next) => {
  try {
    await budgetController.getBudgetEstimate(req, res);
  } catch (error: any) {
    console.error('Route error in /budget/estimate:', error);
    next(error instanceof Error ? error : new Error(String(error)));
  }
});

/**
 * @swagger
 * /api/budget:
 *   get:
 *     summary: Get price per unit vote
 *     description: Returns current budget config (price per unit vote). Admin only.
 *     tags: [Budget]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Budget config retrieved successfully
 *       404:
 *         description: Budget config not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 *   post:
 *     summary: Set price per unit vote
 *     description: Create or set the price per unit vote. Admin only.
 *     tags: [Budget]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pricePerUnitVote]
 *             properties:
 *               pricePerUnitVote:
 *                 type: number
 *                 minimum: 0
 *                 exclusiveMinimum: true
 *                 example: 0.5
 *     responses:
 *       201:
 *         description: Price per unit vote set successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 *   put:
 *     summary: Update price per unit vote
 *     description: Update the price per unit vote. Admin only.
 *     tags: [Budget]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pricePerUnitVote]
 *             properties:
 *               pricePerUnitVote:
 *                 type: number
 *                 minimum: 0
 *                 exclusiveMinimum: true
 *     responses:
 *       200:
 *         description: Price per unit vote updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 */
router.get('/', requireAnyRole('admin'), async (req, res, next) => {
  try {
    await budgetController.getPricePerUnitVote(req, res);
  } catch (error: any) {
    console.error('Route error in /budget:', error);
    next(error instanceof Error ? error : new Error(String(error)));
  }
});

router.post('/', requireAnyRole('admin'), async (req, res, next) => {
  try {
    await budgetController.setPricePerUnitVote(req, res);
  } catch (error: any) {
    console.error('Route error in /budget:', error);
    next(error instanceof Error ? error : new Error(String(error)));
  }
});

router.put('/', requireAnyRole('admin'), async (req, res, next) => {
  try {
    await budgetController.updatePricePerUnitVote(req, res);
  } catch (error: any) {
    console.error('Route error in /budget:', error);
    next(error instanceof Error ? error : new Error(String(error)));
  }
});

export default router;
