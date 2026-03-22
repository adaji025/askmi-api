import { Router } from 'express';
import { authenticate, requireAnyRole } from '../middleware/authMiddleware.js';
import { analyticsController } from '../controllers/analyticsController.js';

const router = Router();

router.use(authenticate);
router.use(requireAnyRole('brand', 'admin'));

/**
 * @swagger
 * /api/brand/analytics:
 *   get:
 *     summary: Get all analytics
 *     description: |
 *       Single endpoint returning complete dashboard analytics - summary stats (total votes, active campaigns,
 *       avg response rate, total spend), vote collection chart data, campaigns table, active campaigns with
 *       progress, and recent activity.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: campaignsLimit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Max campaigns in table and active list
 *       - in: query
 *         name: activityLimit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Max recent activity items
 *       - in: query
 *         name: chartYear
 *         schema:
 *           type: integer
 *         description: Year for vote collection chart (default current year)
 *     responses:
 *       200:
 *         description: Analytics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Brand or Admin only
 */
router.get('/', async (req, res, next) => {
  try {
    await analyticsController.getAll(req, res);
  } catch (error: any) {
    next(error instanceof Error ? error : new Error(String(error)));
  }
});

export default router;
