import { Router, type Request, type Response } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { prisma } from '../index.js';

const router = Router();

router.use(authenticate);
router.use(authorize('admin'));

const computeInfluencerMetrics = (influencer: {
  surveyResponses: Array<{
    campaignId: string;
    createdAt: Date;
  }>;
  campaignApplications: Array<{
    campaignId: string;
    status: 'pending' | 'approved' | 'rejected';
  }>;
  pollVerification: { status: 'submitted' | 'approved' | 'rejected' } | null;
}) => {
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const currentWindowStart = now - sevenDaysMs;
  const previousWindowStart = now - (2 * sevenDaysMs);

  const subscribedCampaignIds = new Set(
    influencer.campaignApplications
      .filter((application) => application.status === 'approved')
      .map((application) => application.campaignId),
  );
  const totalCampaign = subscribedCampaignIds.size;

  const totalVotes = influencer.surveyResponses.length;
  const averageVote = totalCampaign > 0
    ? Number((totalVotes / totalCampaign).toFixed(2))
    : 0;

  const recentVotes = influencer.surveyResponses.filter(
    (response) => new Date(response.createdAt).getTime() >= currentWindowStart,
  ).length;
  const previousVotes = influencer.surveyResponses.filter((response) => {
    const createdAt = new Date(response.createdAt).getTime();
    return createdAt >= previousWindowStart && createdAt < currentWindowStart;
  }).length;

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

const buildResponseMapByInfluencer = (
  rows: Array<{ userId: string | null; campaignId: string; createdAt: Date }>,
): Map<string, Array<{ campaignId: string; createdAt: Date }>> => {
  const map = new Map<string, Array<{ campaignId: string; createdAt: Date }>>();
  for (const row of rows) {
    if (!row.userId) continue;
    const existing = map.get(row.userId) ?? [];
    existing.push({ campaignId: row.campaignId, createdAt: row.createdAt });
    map.set(row.userId, existing);
  }
  return map;
};

const buildApplicationMapByInfluencer = (
  rows: Array<{ influencerId: string; campaignId: string; status: 'pending' | 'approved' | 'rejected' }>,
): Map<string, Array<{ campaignId: string; status: 'pending' | 'approved' | 'rejected' }>> => {
  const map = new Map<string, Array<{ campaignId: string; status: 'pending' | 'approved' | 'rejected' }>>();
  for (const row of rows) {
    const existing = map.get(row.influencerId) ?? [];
    existing.push({ campaignId: row.campaignId, status: row.status });
    map.set(row.influencerId, existing);
  }
  return map;
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
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const totalInfluencers = influencers.length;
    const influencerIds = influencers.map((influencer) => influencer.id);
    const responseRows = await prisma.surveyResponse.findMany({
      where: {
        userId: { in: influencerIds },
      },
      select: {
        userId: true,
        campaignId: true,
        createdAt: true,
      },
    });
    const applicationRows = await prisma.campaignApplication.findMany({
      where: {
        influencerId: { in: influencerIds },
      },
      select: {
        influencerId: true,
        campaignId: true,
        status: true,
      },
    });
    const responsesByInfluencer = buildResponseMapByInfluencer(responseRows);
    const applicationsByInfluencer = buildApplicationMapByInfluencer(applicationRows);

    const pendingApprovals = influencers.filter((influencer) => !influencer.isApproved).length;
    const flaggedRisk = influencers.filter((influencer) => influencer.pollVerification?.status === 'rejected').length;

    const enrichedInfluencers = influencers.map((influencer) => {
      return {
        ...influencer,
        ...computeInfluencerMetrics({
          pollVerification: influencer.pollVerification,
          surveyResponses: responsesByInfluencer.get(influencer.id) ?? [],
          campaignApplications: applicationsByInfluencer.get(influencer.id) ?? [],
        }),
      };
    });

    const topPerformerRecord = enrichedInfluencers.reduce<typeof enrichedInfluencers[number] | null>((currentTop, influencer) => {
      if (!currentTop || influencer.totalCampaign > currentTop.totalCampaign) {
        return influencer;
      }
      return currentTop;
    }, null);

    const topPerformer = topPerformerRecord
      ? {
        id: topPerformerRecord.id,
        fullName: topPerformerRecord.fullName,
        email: topPerformerRecord.email,
        totalSurveys: topPerformerRecord.totalCampaign,
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
      influencers: enrichedInfluencers.map(({ pollVerification, ...influencer }) => influencer),
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
      },
    });

    if (!influencer) {
      return res.status(404).json({
        success: false,
        message: 'Influencer not found',
      });
    }

    const responseRows = await prisma.surveyResponse.findMany({
      where: {
        userId: influencer.id,
      },
      select: {
        campaignId: true,
        createdAt: true,
      },
    });
    const applicationRows = await prisma.campaignApplication.findMany({
      where: {
        influencerId: influencer.id,
      },
      select: {
        campaignId: true,
        status: true,
      },
    });

    return res.status(200).json({
      success: true,
      influencer: {
        ...(() => {
          const { pollVerification, ...baseInfluencer } = influencer;
          return {
            ...baseInfluencer,
            ...computeInfluencerMetrics({
              pollVerification,
              surveyResponses: responseRows,
              campaignApplications: applicationRows,
            }),
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
