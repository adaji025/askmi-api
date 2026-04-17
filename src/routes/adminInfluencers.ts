import { Router, type Request, type Response } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { prisma } from '../index.js';

const router = Router();

router.use(authenticate);
router.use(authorize('admin'));

const computeInfluencerMetrics = (influencer: {
  surveys: Array<{
    campaignId: string | null;
    surveyResponses: Array<{ createdAt: Date }>;
  }>;
  pollVerification: { status: 'submitted' | 'approved' | 'rejected' } | null;
}) => {
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const currentWindowStart = now - sevenDaysMs;
  const previousWindowStart = now - (2 * sevenDaysMs);

  const totalCampaign = new Set(
    influencer.surveys
      .map((survey) => survey.campaignId)
      .filter((campaignId): campaignId is string => Boolean(campaignId)),
  ).size;

  const totalVotes = influencer.surveys.reduce((sum, survey) => sum + survey.surveyResponses.length, 0);
  const averageVote = influencer.surveys.length > 0
    ? Number((totalVotes / influencer.surveys.length).toFixed(2))
    : 0;

  const recentVotes = influencer.surveys.reduce((sum, survey) => (
    sum + survey.surveyResponses.filter((response) => new Date(response.createdAt).getTime() >= currentWindowStart).length
  ), 0);
  const previousVotes = influencer.surveys.reduce((sum, survey) => (
    sum + survey.surveyResponses.filter((response) => {
      const createdAt = new Date(response.createdAt).getTime();
      return createdAt >= previousWindowStart && createdAt < currentWindowStart;
    }).length
  ), 0);

  let deviationTrend: 'up' | 'down' | 'stable' = 'stable';
  if (recentVotes > previousVotes) deviationTrend = 'up';
  else if (recentVotes < previousVotes) deviationTrend = 'down';

  const ocrAccuracy = influencer.pollVerification?.status === 'approved'
    ? 100
    : influencer.pollVerification?.status === 'submitted'
      ? 50
      : 0;

  const performanceScore = Number(Math.min(
    100,
    (averageVote * 0.5) + (totalCampaign * 5) + (recentVotes * 1.5) + (ocrAccuracy * 0.2),
  ).toFixed(2));

  return {
    totalCampaign,
    averageVote,
    performanceScore,
    deviationTrend,
    ocrAccuracy,
  };
};

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
 *                     allOf:
 *                       - $ref: '#/components/schemas/User'
 *                       - type: object
 *                         properties:
 *                           totalCampaign:
 *                             type: integer
 *                           averageVote:
 *                             type: number
 *                             format: float
 *                           performanceScore:
 *                             type: number
 *                             format: float
 *                           deviationTrend:
 *                             type: string
 *                             enum: [up, down, stable]
 *                           ocrAccuracy:
 *                             type: number
 *                             format: float
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
        surveys: {
          select: {
            campaignId: true,
            surveyResponses: {
              select: {
                createdAt: true,
              },
            },
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

    const enrichedInfluencers = influencers.map((influencer) => {
      return {
        ...influencer,
        ...computeInfluencerMetrics(influencer),
      };
    });

    const topPerformerRecord = enrichedInfluencers.reduce<typeof enrichedInfluencers[number] | null>((currentTop, influencer) => {
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
      influencers: enrichedInfluencers.map(({ pollVerification, _count, surveys, ...influencer }) => influencer),
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
 *                   allOf:
 *                     - $ref: '#/components/schemas/User'
 *                     - type: object
 *                       properties:
 *                         totalCampaign:
 *                           type: integer
 *                         averageVote:
 *                           type: number
 *                           format: float
 *                         performanceScore:
 *                           type: number
 *                           format: float
 *                         deviationTrend:
 *                           type: string
 *                           enum: [up, down, stable]
 *                         ocrAccuracy:
 *                           type: number
 *                           format: float
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
        pollVerification: {
          select: {
            status: true,
          },
        },
        surveys: {
          select: {
            campaignId: true,
            surveyResponses: {
              select: {
                createdAt: true,
              },
            },
          },
        },
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
      influencer: {
        ...(() => {
          const { pollVerification, surveys, ...baseInfluencer } = influencer;
          return {
            ...baseInfluencer,
            ...computeInfluencerMetrics({ pollVerification, surveys }),
          };
        })(),
      },
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
