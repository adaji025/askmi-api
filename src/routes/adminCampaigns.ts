import { Router, type Request, type Response } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { prisma } from '../index.js';

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

const withCampaignMetrics = (
  campaign: CampaignRecord,
  verificationByUserId: Map<string, 'submitted' | 'approved' | 'rejected'>,
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

  const { surveyResponses, ...baseCampaign } = campaign;
  return {
    ...baseCampaign,
    brand: campaign.user,
    status,
    targetVotes,
    deliveredVote,
    deviation,
    ocrAccuracy,
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

    const verificationByUserId = await buildVerificationMap(campaigns);
    const campaignWithMetrics = campaigns.map((campaign) => withCampaignMetrics(campaign, verificationByUserId));

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

    const verificationByUserId = await buildVerificationMap([campaign]);
    const campaignWithMetrics = withCampaignMetrics(campaign, verificationByUserId);

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

export default router;
