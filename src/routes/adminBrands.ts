import { Router, type Request, type Response } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { adminBrandService } from '../services/adminBrandService.js';

const router = Router();

router.use(authenticate);
router.use(authorize('admin'));

/**
 * @swagger
 * /api/admin/brands:
 *   get:
 *     summary: Get all brands (Admin only)
 *     description: Admin can view all brand users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Brands retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 statistics:
 *                   type: object
 *                   properties:
 *                     totalBrands:
 *                       type: integer
 *                     activeCampaigns:
 *                       type: integer
 *                       description: Campaigns with isActive true and not completed
 *                     pendingCampaigns:
 *                       type: integer
 *                       description: Not active and not completed
 *                     completedCampaigns:
 *                       type: integer
 *                     totalRevenue:
 *                       type: number
 *                       format: float
 *                       description: All brand votes × price per unit vote
 *                     totalVotes:
 *                       type: integer
 *                       description: Total survey responses for brand-owned campaigns
 *                 brands:
 *                   type: array
 *                   description: User fields plus totalCampaign, activeCampaign (running), totalSpend (responses × price per vote)
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/User'
 *                       - type: object
 *                         required:
 *                           - totalCampaign
 *                           - activeCampaign
 *                           - totalSpend
 *                         properties:
 *                           totalCampaign:
 *                             type: integer
 *                             example: 5
 *                           activeCampaign:
 *                             type: integer
 *                             description: Campaigns with isActive true and isCompleted false
 *                             example: 2
 *                           totalSpend:
 *                             type: number
 *                             format: float
 *                             description: Estimated spend from collected responses
 *                             example: 125.5
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { statistics, brands } = await adminBrandService.getBrands();
    res.status(200).json({
      success: true,
      statistics,
      brands,
    });
  } catch (error) {
    console.error('Get brands error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching brands',
    });
  }
});

/**
 * @swagger
 * /api/admin/brands/{id}:
 *   get:
 *     summary: Get a single brand (Admin only)
 *     description: Returns brand profile, metrics, and campaigns as id + name only. Fails if user is not a brand.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Brand user id
 *     responses:
 *       200:
 *         description: Brand retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 brand:
 *                   allOf:
 *                     - $ref: '#/components/schemas/User'
 *                     - type: object
 *                       required:
 *                         - totalCampaign
 *                         - activeCampaign
 *                         - totalSpend
 *                         - campaigns
 *                       properties:
 *                         totalCampaign:
 *                           type: integer
 *                         activeCampaign:
 *                           type: integer
 *                         totalSpend:
 *                           type: number
 *                           format: float
 *                         campaigns:
 *                           type: array
 *                           description: id and campaignName only, newest first
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               campaignName:
 *                                 type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: Brand not found
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const brand = await adminBrandService.getBrandById(id);

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found',
      });
    }

    res.status(200).json({
      success: true,
      brand,
    });
  } catch (error) {
    console.error('Get brand error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching the brand',
    });
  }
});

export default router;
