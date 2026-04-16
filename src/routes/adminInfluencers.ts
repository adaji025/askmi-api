import { Router, type Request, type Response } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { prisma } from '../index.js';

const router = Router();

router.use(authenticate);
router.use(authorize('admin'));

/**
 * @swagger
 * /api/admin/influencers:
 *   get:
 *     summary: Get all influencers (Admin only)
 *     description: Admin can view all users with influencer role.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Influencers retrieved successfully
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
 *                     totalInfluencers:
 *                       type: integer
 *                       example: 42
 *                     pendingApprovals:
 *                       type: integer
 *                       example: 8
 *                     flaggedRisk:
 *                       type: integer
 *                       description: Influencers with rejected poll verification status
 *                       example: 3
 *                     topPerformer:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id:
 *                           type: string
 *                         fullName:
 *                           type: string
 *                         email:
 *                           type: string
 *                           format: email
 *                         totalSurveys:
 *                           type: integer
 *                           example: 12
 *                 influencers:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const influencers = await prisma.user.findMany({
      where: {
        role: 'influencer',
      },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        company: true,
        companyCAC: true,
        companySize: true,
        industry: true,
        fullName: true,
        countryCode: true,
        lang: true,
        role: true,
        isApproved: true,
        createdAt: true,
        updatedAt: true,
        pollVerification: {
          select: {
            status: true,
          },
        },
        _count: {
          select: {
            surveys: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const totalInfluencers = influencers.length;
    const pendingApprovals = influencers.filter((influencer) => !influencer.isApproved).length;
    const flaggedRisk = influencers.filter((influencer) => influencer.pollVerification?.status === 'rejected').length;

    const topPerformerRecord = influencers.reduce<typeof influencers[number] | null>((currentTop, influencer) => {
      if (!currentTop || influencer._count.surveys > currentTop._count.surveys) {
        return influencer;
      }
      return currentTop;
    }, null);

    const topPerformer = topPerformerRecord
      ? {
        id: topPerformerRecord.id,
        fullName: topPerformerRecord.fullName,
        email: topPerformerRecord.email,
        totalSurveys: topPerformerRecord._count.surveys,
      }
      : null;

    res.status(200).json({
      success: true,
      statistics: {
        totalInfluencers,
        pendingApprovals,
        flaggedRisk,
        topPerformer,
      },
      influencers: influencers.map(({ pollVerification, _count, ...influencer }) => influencer),
    });
  } catch (error) {
    console.error('Get influencers error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching influencers',
    });
  }
});

/**
 * @swagger
 * /api/admin/influencers/{id}:
 *   get:
 *     summary: Get a single influencer (Admin only)
 *     description: Admin can view one influencer by user ID.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Influencer user ID
 *     responses:
 *       200:
 *         description: Influencer retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 influencer:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: Influencer not found
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const influencer = await prisma.user.findFirst({
      where: {
        id: userId,
        role: 'influencer',
      },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        company: true,
        companyCAC: true,
        companySize: true,
        industry: true,
        fullName: true,
        countryCode: true,
        lang: true,
        role: true,
        isApproved: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!influencer) {
      return res.status(404).json({
        success: false,
        message: 'Influencer not found',
      });
    }

    return res.status(200).json({
      success: true,
      influencer,
    });
  } catch (error) {
    console.error('Get influencer error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching influencer',
    });
  }
});

export default router;
