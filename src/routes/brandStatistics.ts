import { Router } from 'express';
import { authenticate, requireAnyRole } from '../middleware/authMiddleware.js';
import { brandStatisticsController } from '../controllers/brandStatisticsController.js';

const router = Router();

router.use(authenticate);
router.use(requireAnyRole('brand', 'admin'));

/**
 * @swagger
 * /api/brand/statistics:
 *   get:
 *     summary: Get all brand statistics
 *     description: |
 *       Returns complete dashboard data in one call - summary stats, active campaigns with progress,
 *       and recent activity feed.
 *     tags: [Brand Statistics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: campaignsLimit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Max active campaigns to return (max 50)
 *       - in: query
 *         name: activityLimit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Max recent activity items (max 50)
 *     responses:
 *       200:
 *         description: Brand statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 stats:
 *                   type: object
 *                   properties:
 *                     activeCampaigns:
 *                       type: integer
 *                     totalResponses:
 *                       type: integer
 *                     totalSurveys:
 *                       type: integer
 *                     completionRate:
 *                       type: number
 *                 activeCampaigns:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       campaignName:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [active, completed]
 *                       responseCount:
 *                         type: integer
 *                       totalVoteNeeded:
 *                         type: integer
 *                       progressPercent:
 *                         type: number
 *                 recentActivity:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       message:
 *                         type: string
 *                       campaignId:
 *                         type: string
 *                       campaignName:
 *                         type: string
 *                       responseCount:
 *                         type: integer
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       timeAgo:
 *                         type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Brand or Admin only
 */
router.get('/', async (req, res, next) => {
  try {
    await brandStatisticsController.getAll(req, res);
  } catch (error: any) {
    next(error instanceof Error ? error : new Error(String(error)));
  }
});

export default router;
