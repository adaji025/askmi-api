import { Router, type Request, type Response } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { prisma } from '../index.js';
import { DEFAULT_PRICE_PER_UNIT_VOTE } from '../services/budgetService.js';

const router = Router();

router.use(authenticate);
router.use(authorize('admin'));

type CampaignRecord = {
  id: string;
  campaignName: string;
  description: string;
  surveySource: string;
  targetAudience: unknown;
  totalVoteNeeded: number;
  numberOfQuestions: number;
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
  isCompleted: boolean;
  numberOfInfluencer: number;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  surveys: Array<{
    id: string;
    title: string | null;
    questions: unknown;
    campaignId: string | null;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  user: {
    id: string;
    fullName: string;
    company: string | null;
    email: string;
  };
  surveyResponses: Array<{ userId: string | null }>;
};

type InfluencerSummary = {
  fullName: string;
  email: string;
  responses: number;
};

const getCampaignStatus = (campaign: Pick<CampaignRecord, 'isCompleted' | 'isActive'>): 'completed' | 'active' | 'inactive' => {
  if (campaign.isCompleted) return 'completed';
  if (campaign.isActive) return 'active';
  return 'inactive';
};

const buildVerificationMap = async (campaigns: CampaignRecord[]): Promise<Map<string, 'submitted' | 'approved' | 'rejected'>> => {
  const responderIds = Array.from(
    new Set(
      campaigns.flatMap((campaign) => campaign.surveyResponses
        .map((response) => response.userId)
        .filter((userId): userId is string => Boolean(userId))),
    ),
  );

  if (responderIds.length === 0) {
    return new Map();
  }

  const pollVerifications = await prisma.pollVerification.findMany({
    where: {
      userId: {
        in: responderIds,
      },
    },
    select: {
      userId: true,
      status: true,
    },
  });

  return new Map(
    pollVerifications.map((verification) => [verification.userId, verification.status]),
  );
};

const buildInfluencerProfileMap = async (campaigns: CampaignRecord[]): Promise<Map<string, { fullName: string; email: string }>> => {
  const responderIds = Array.from(
    new Set(
      campaigns.flatMap((campaign) => campaign.surveyResponses
        .map((response) => response.userId)
        .filter((userId): userId is string => Boolean(userId))),
    ),
  );

  if (responderIds.length === 0) {
    return new Map();
  }

  const users = await prisma.user.findMany({
    where: {
      id: {
        in: responderIds,
      },
    },
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  });

  return new Map(users.map((user) => [user.id, { fullName: user.fullName, email: user.email }]));
};

const withCampaignMetrics = (
  campaign: CampaignRecord,
  verificationByUserId: Map<string, 'submitted' | 'approved' | 'rejected'>,
  pricePerUnitVote: number,
  influencerProfileByUserId: Map<string, { fullName: string; email: string }>,
) => {
  const deliveredVote = campaign.surveyResponses.length;
  const targetVotes = campaign.totalVoteNeeded;
  const deviation = deliveredVote - targetVotes;
  const status = getCampaignStatus(campaign);

  const responderStatuses = campaign.surveyResponses
    .map((response) => (response.userId ? verificationByUserId.get(response.userId) : null))
    .filter((verificationStatus): verificationStatus is 'submitted' | 'approved' | 'rejected' => Boolean(verificationStatus));

  const approvedResponders = responderStatuses.filter((verificationStatus) => verificationStatus === 'approved').length;
  const ocrAccuracy = responderStatuses.length > 0
    ? Number(((approvedResponders / responderStatuses.length) * 100).toFixed(2))
    : 0;
  const influencerResponses = campaign.surveyResponses.reduce((acc, response) => {
    if (!response.userId) return acc;
    const current = acc.get(response.userId) ?? 0;
    acc.set(response.userId, current + 1);
    return acc;
  }, new Map<string, number>());

  const influencers: InfluencerSummary[] = Array.from(influencerResponses.entries())
    .map(([userId, responses]) => {
      const profile = influencerProfileByUserId.get(userId);
      if (!profile) return null;
      return {
        fullName: profile.fullName,
        email: profile.email,
        responses,
      };
    })
    .filter((influencer): influencer is InfluencerSummary => Boolean(influencer));

  const estimatedPrice = Number((campaign.totalVoteNeeded * campaign.numberOfQuestions * pricePerUnitVote).toFixed(2));
  const { surveyResponses, ...baseCampaign } = campaign;
  return {
    ...baseCampaign,
    brand: campaign.user,
    status,
    targetVotes,
    deliveredVote,
    deviation,
    ocrAccuracy,
    estimatedPrice,
    influencerEstimatedPrice: Number((estimatedPrice * 0.5).toFixed(2)),
    influencers,
  };
};

/**
 * @swagger
 * /api/admin/campaigns:
 *   get:
 *     summary: Get all campaigns (Admin only)
 *     description: Returns campaign list with delivery performance metrics and admin campaign statistics.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Campaigns retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 */
router.get('/campaigns', async (req: Request, res: Response) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      select: {
        id: true,
        campaignName: true,
        description: true,
        surveySource: true,
        targetAudience: true,
        totalVoteNeeded: true,
        numberOfQuestions: true,
        startDate: true,
        endDate: true,
        isActive: true,
        isCompleted: true,
        numberOfInfluencer: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
        surveys: {
          select: {
            id: true,
            title: true,
            questions: true,
            campaignId: true,
            userId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            company: true,
            email: true,
          },
        },
        surveyResponses: {
          select: {
            userId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const budgetConfig = await prisma.budgetConfig.findUnique({
      where: { key: 'default' },
      select: { pricePerUnitVote: true },
    });
    const pricePerUnitVote = budgetConfig
      ? Number(budgetConfig.pricePerUnitVote)
      : DEFAULT_PRICE_PER_UNIT_VOTE;

    const verificationByUserId = await buildVerificationMap(campaigns);
    const influencerProfileByUserId = await buildInfluencerProfileMap(campaigns);
    const campaignWithMetrics = campaigns.map((campaign) => withCampaignMetrics(
      campaign,
      verificationByUserId,
      pricePerUnitVote,
      influencerProfileByUserId,
    ));

    const statistics = {
      totalCampaign: campaignWithMetrics.length,
      active: campaignWithMetrics.filter((campaign) => campaign.status === 'active').length,
      lagging: campaignWithMetrics.filter((campaign) => campaign.deviation < 0).length,
    };

    res.status(200).json({
      success: true,
      statistics,
      campaigns: campaignWithMetrics.map(({ user, ...campaign }) => campaign),
    });
  } catch (error) {
    console.error('Get admin campaigns error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching campaigns',
    });
  }
});

/**
 * @swagger
 * /api/admin/campaigns/{id}:
 *   get:
 *     summary: Get single campaign by ID (Admin only)
 *     description: Returns one campaign with delivery performance metrics.
 *     tags: [Admin]
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: Campaign not found
 */
router.get('/campaigns/:id', async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      select: {
        id: true,
        campaignName: true,
        description: true,
        surveySource: true,
        targetAudience: true,
        totalVoteNeeded: true,
        numberOfQuestions: true,
        startDate: true,
        endDate: true,
        isActive: true,
        isCompleted: true,
        numberOfInfluencer: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
        surveys: {
          select: {
            id: true,
            title: true,
            questions: true,
            campaignId: true,
            userId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            company: true,
            email: true,
          },
        },
        surveyResponses: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found',
      });
    }

    const budgetConfig = await prisma.budgetConfig.findUnique({
      where: { key: 'default' },
      select: { pricePerUnitVote: true },
    });
    const pricePerUnitVote = budgetConfig
      ? Number(budgetConfig.pricePerUnitVote)
      : DEFAULT_PRICE_PER_UNIT_VOTE;

    const verificationByUserId = await buildVerificationMap([campaign]);
    const influencerProfileByUserId = await buildInfluencerProfileMap([campaign]);
    const campaignWithMetrics = withCampaignMetrics(
      campaign,
      verificationByUserId,
      pricePerUnitVote,
      influencerProfileByUserId,
    );

    return res.status(200).json({
      success: true,
      campaign: campaignWithMetrics,
    });
  } catch (error) {
    console.error('Get admin campaign by id error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching campaign',
    });
  }
});

/**
 * @swagger
 * /api/admin/campaigns/{id}/extend-end-date:
 *   patch:
 *     summary: Extend campaign end date (Admin only)
 *     description: Extends a campaign end date. New end date must be later than the current end date.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [endDate]
 *             properties:
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 example: 2026-06-15T23:59:59.000Z
 *     responses:
 *       200:
 *         description: Campaign end date extended successfully
 *       400:
 *         description: Invalid request body or date
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: Campaign not found
 */
router.patch('/campaigns/:id/extend-end-date', async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { endDate } = req.body as { endDate?: string };

    if (!endDate) {
      return res.status(400).json({
        success: false,
        message: 'endDate is required',
      });
    }

    const newEndDate = new Date(endDate);
    if (Number.isNaN(newEndDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'endDate must be a valid ISO date string',
      });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      select: {
        id: true,
        endDate: true,
      },
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found',
      });
    }

    if (campaign.endDate && newEndDate <= campaign.endDate) {
      return res.status(400).json({
        success: false,
        message: 'New endDate must be later than current campaign endDate',
      });
    }

    const updatedCampaign = await prisma.campaign.update({
      where: { id },
      data: { endDate: newEndDate },
      select: {
        id: true,
        campaignName: true,
        startDate: true,
        endDate: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Campaign end date extended successfully',
      campaign: updatedCampaign,
    });
  } catch (error) {
    console.error('Extend campaign end date error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while extending campaign end date',
    });
  }
});

export default router;
