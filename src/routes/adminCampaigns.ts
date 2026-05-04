import type { CampaignResultImageReviewStatus } from '@prisma/client';
import { Router, type Request, type Response } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { prisma } from '../index.js';
import { DEFAULT_PRICE_PER_UNIT_VOTE } from '../services/budgetService.js';
import { campaignService } from '../services/campaignService.js';
import {
  adminListCampaignResultImagesQuerySchema,
  adminReviewCampaignResultImageSchema,
} from '../validators/campaignValidators.js';

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

type ResultImageWithReview = {
  id: string;
  surveyQuestionId: string | null;
  imageUrl: string;
  caption: string | null;
  createdAt: Date;
  reviewStatus: CampaignResultImageReviewStatus;
  reviewedVotes: number | null;
  reviewedResponseObject: unknown | null;
  reviewNotes: string | null;
  reviewedAt: Date | null;
  reviewedByAdminId: string | null;
};

type InfluencerSummary = {
  influencerId: string;
  fullName: string;
  email: string;
  responses: number;
  reviewedVotesTotal: number;
  resultImages: ResultImageWithReview[];
};

const decodeReviewObjectFromNotes = (value: string | null): { note: string | null; responseObject: unknown | null } => {
  if (!value) {
    return { note: null, responseObject: null };
  }
  try {
    const parsed = JSON.parse(value) as { note?: unknown; responseObject?: unknown };
    return {
      note: typeof parsed.note === 'string' || parsed.note === null ? (parsed.note ?? null) : null,
      responseObject: parsed.responseObject ?? null,
    };
  } catch {
    return { note: value, responseObject: null };
  }
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

const buildInfluencerProfileMap = async (userIds: string[]): Promise<Map<string, { fullName: string; email: string }>> => {
  if (userIds.length === 0) {
    return new Map();
  }

  const users = await prisma.user.findMany({
    where: {
      id: {
        in: userIds,
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

const buildApprovedApplicationMap = async (campaignIds: string[]): Promise<Map<string, string[]>> => {
  if (campaignIds.length === 0) {
    return new Map();
  }

  const applications = await prisma.campaignApplication.findMany({
    where: {
      campaignId: { in: campaignIds },
      status: 'approved',
    },
    select: {
      campaignId: true,
      influencerId: true,
    },
  });

  const map = new Map<string, string[]>();
  for (const application of applications) {
    const existing = map.get(application.campaignId) ?? [];
    existing.push(application.influencerId);
    map.set(application.campaignId, existing);
  }
  return map;
};

const withCampaignMetrics = (
  campaign: CampaignRecord,
  verificationByUserId: Map<string, 'submitted' | 'approved' | 'rejected'>,
  pricePerUnitVote: number,
  influencerProfileByUserId: Map<string, { fullName: string; email: string }>,
  approvedInfluencerIds: string[],
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
  for (const influencerId of approvedInfluencerIds) {
    if (!influencerResponses.has(influencerId)) {
      influencerResponses.set(influencerId, 0);
    }
  }

  const influencers: InfluencerSummary[] = Array.from(influencerResponses.entries())
    .map(([userId, responses]) => {
      const profile = influencerProfileByUserId.get(userId);
      if (!profile) return null;
      return {
        influencerId: userId,
        fullName: profile.fullName,
        email: profile.email,
        responses,
        reviewedVotesTotal: 0,
        resultImages: [] as InfluencerSummary['resultImages'],
      };
    })
    .filter((influencer): influencer is InfluencerSummary => influencer !== null);

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

async function attachResultImagesToInfluencers<T extends { id: string; influencers: InfluencerSummary[] }>(
  campaigns: T[],
): Promise<Array<T & { reviewedDeliveredVote: number }>> {
  if (campaigns.length === 0) {
    return campaigns.map((c) => ({ ...c, reviewedDeliveredVote: 0 }));
  }
  const campaignIds = campaigns.map((c) => c.id);
  const rows = await prisma.campaignResultImage.findMany({
    where: { campaignId: { in: campaignIds } },
    select: {
      id: true,
      campaignId: true,
      influencerId: true,
      surveyQuestionId: true,
      imageUrl: true,
      caption: true,
      createdAt: true,
      reviewStatus: true,
      reviewedVotes: true,
      reviewNotes: true,
      reviewedAt: true,
      reviewedByAdminId: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  const byCampaign = new Map<string, Map<string, ResultImageWithReview[]>>();
  for (const row of rows) {
    let byInfluencer = byCampaign.get(row.campaignId);
    if (!byInfluencer) {
      byInfluencer = new Map();
      byCampaign.set(row.campaignId, byInfluencer);
    }
    const list = byInfluencer.get(row.influencerId) ?? [];
    const decoded = decodeReviewObjectFromNotes(row.reviewNotes);
    const image: ResultImageWithReview = {
      id: row.id,
      surveyQuestionId: row.surveyQuestionId,
      imageUrl: row.imageUrl,
      caption: row.caption,
      createdAt: row.createdAt,
      reviewStatus: row.reviewStatus,
      reviewedVotes: row.reviewedVotes,
      reviewedResponseObject: decoded.responseObject,
      reviewNotes: decoded.note,
      reviewedAt: row.reviewedAt,
      reviewedByAdminId: row.reviewedByAdminId,
    };
    list.push(image);
    byInfluencer.set(row.influencerId, list);
  }

  return campaigns.map((campaign) => {
    let reviewedDeliveredVote = 0;
    const influencers = campaign.influencers.map((influencer) => {
      const resultImages = byCampaign.get(campaign.id)?.get(influencer.influencerId) ?? [];
      let reviewedVotesTotal = 0;
      for (const img of resultImages) {
        if (img.reviewStatus === 'approved' && img.reviewedVotes !== null) {
          reviewedVotesTotal += img.reviewedVotes;
          reviewedDeliveredVote += img.reviewedVotes;
        }
      }
      return {
        ...influencer,
        resultImages,
        reviewedVotesTotal,
      };
    });
    return {
      ...campaign,
      influencers,
      reviewedDeliveredVote,
    };
  });
}

function applyReviewedVotesAsDelivered<T extends { targetVotes: number; deliveredVote: number; deviation: number; reviewedDeliveredVote?: number }>(
  campaigns: T[],
): T[] {
  return campaigns.map((campaign) => ({
    ...campaign,
    deliveredVote: campaign.reviewedDeliveredVote ?? campaign.deliveredVote,
    deviation: (campaign.reviewedDeliveredVote ?? campaign.deliveredVote) - campaign.targetVotes,
  }));
}

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
    const approvedInfluencerIdsByCampaignId = await buildApprovedApplicationMap(campaigns.map((campaign) => campaign.id));
    const responderIds = campaigns.flatMap((campaign) => campaign.surveyResponses
      .map((response) => response.userId)
      .filter((userId): userId is string => Boolean(userId)));
    const approvedInfluencerIds = campaigns.flatMap((campaign) => approvedInfluencerIdsByCampaignId.get(campaign.id) ?? []);
    const influencerProfileByUserId = await buildInfluencerProfileMap(Array.from(new Set([...responderIds, ...approvedInfluencerIds])));
    let campaignWithMetrics = campaigns.map((campaign) => withCampaignMetrics(
      campaign,
      verificationByUserId,
      pricePerUnitVote,
      influencerProfileByUserId,
      approvedInfluencerIdsByCampaignId.get(campaign.id) ?? [],
    ));
    campaignWithMetrics = await attachResultImagesToInfluencers(campaignWithMetrics);
    campaignWithMetrics = applyReviewedVotesAsDelivered(campaignWithMetrics);

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
 * /api/admin/campaigns/{campaignId}:
 *   get:
 *     summary: Get single campaign by ID (Admin only)
 *     description: Returns one campaign with delivery performance metrics.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
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
router.get('/campaigns/:campaignId', async (req: Request, res: Response) => {
  try {
    const campaignIdParam = req.params.campaignId;
    const campaignId = Array.isArray(campaignIdParam) ? campaignIdParam[0] : campaignIdParam;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
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
    const approvedInfluencerIdsByCampaignId = await buildApprovedApplicationMap([campaign.id]);
    const responderIds = campaign.surveyResponses
      .map((response) => response.userId)
      .filter((userId): userId is string => Boolean(userId));
    const approvedInfluencerIds = approvedInfluencerIdsByCampaignId.get(campaign.id) ?? [];
    const influencerProfileByUserId = await buildInfluencerProfileMap(Array.from(new Set([...responderIds, ...approvedInfluencerIds])));
    let campaignWithMetrics = withCampaignMetrics(
      campaign,
      verificationByUserId,
      pricePerUnitVote,
      influencerProfileByUserId,
      approvedInfluencerIds,
    );
    [campaignWithMetrics] = await attachResultImagesToInfluencers([campaignWithMetrics]);
    [campaignWithMetrics] = applyReviewedVotesAsDelivered([campaignWithMetrics]);

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
 * /api/admin/campaigns/{campaignId}/applications:
 *   get:
 *     summary: Get influencer join requests for a campaign (Admin only)
 *     description: Returns all influencer applications for the specified campaign.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign ID
 *     responses:
 *       200:
 *         description: Campaign applications retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: Campaign not found
 */
router.get('/campaigns/:campaignId/applications', async (req: Request, res: Response) => {
  try {
    const campaignIdParam = req.params.campaignId;
    const campaignId = Array.isArray(campaignIdParam) ? campaignIdParam[0] : campaignIdParam;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        campaignName: true,
      },
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found',
      });
    }

    const applications = await prisma.campaignApplication.findMany({
      where: { campaignId },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        campaignId: true,
        influencerId: true,
        status: true,
        message: true,
        createdAt: true,
        updatedAt: true,
        influencer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            isApproved: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      campaign,
      count: applications.length,
      applications,
    });
  } catch (error) {
    console.error('Get campaign applications error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching campaign applications',
    });
  }
});

/**
 * @swagger
 * /api/admin/campaign-applications:
 *   get:
 *     summary: Get all influencer join requests (Admin only)
 *     description: 'Returns all campaign applications across all campaigns. Optional query filters: campaignId and status.'
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: campaignId
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter applications by campaign ID
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *         description: Filter applications by status
 *     responses:
 *       200:
 *         description: Campaign applications retrieved successfully
 *       400:
 *         description: Invalid query parameter
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 */
router.get('/campaign-applications', async (req: Request, res: Response) => {
  try {
    const campaignIdRaw = Array.isArray(req.query.campaignId) ? req.query.campaignId[0] : req.query.campaignId;
    const campaignId = typeof campaignIdRaw === 'string' ? campaignIdRaw : undefined;
    const statusRaw = Array.isArray(req.query.status) ? req.query.status[0] : req.query.status;
    const status = typeof statusRaw === 'string' ? statusRaw : undefined;

    if (status && !['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'status must be one of: pending, approved, rejected',
      });
    }

    const whereClause: {
      campaignId?: string;
      status?: 'pending' | 'approved' | 'rejected';
    } = {};

    if (campaignId) {
      whereClause.campaignId = campaignId;
    }

    if (status) {
      whereClause.status = status as 'pending' | 'approved' | 'rejected';
    }

    const applications = await prisma.campaignApplication.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        campaignId: true,
        influencerId: true,
        status: true,
        message: true,
        createdAt: true,
        updatedAt: true,
        campaign: {
          select: {
            id: true,
            campaignName: true,
            userId: true,
          },
        },
        influencer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            isApproved: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      count: applications.length,
      filters: {
        campaignId: campaignId ?? null,
        status: status ?? null,
      },
      applications,
    });
  } catch (error) {
    console.error('Get all campaign applications error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching campaign applications',
    });
  }
});

/**
 * @swagger
 * /api/admin/campaign-applications/{applicationId}/approve:
 *   patch:
 *     summary: Approve influencer campaign request (Admin only)
 *     description: Approves a campaign application request and updates campaign influencer count.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign application ID
 *     responses:
 *       200:
 *         description: Campaign application approved successfully
 *       400:
 *         description: Invalid request or status transition
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: Campaign application not found
 */
router.patch('/campaign-applications/:applicationId/approve', async (req: Request, res: Response) => {
  try {
    const applicationId = Array.isArray(req.params.applicationId)
      ? req.params.applicationId[0]
      : req.params.applicationId;

    const existingApplication = await prisma.campaignApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        campaignId: true,
        influencerId: true,
        status: true,
      },
    });

    if (!existingApplication) {
      return res.status(404).json({
        success: false,
        message: 'Campaign application not found',
      });
    }

    if (existingApplication.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Campaign application is already approved',
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const application = await tx.campaignApplication.update({
        where: { id: applicationId },
        data: { status: 'approved' },
        select: {
          id: true,
          campaignId: true,
          influencerId: true,
          status: true,
          message: true,
          createdAt: true,
          updatedAt: true,
          influencer: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      });

      const approvedCount = await tx.campaignApplication.count({
        where: {
          campaignId: application.campaignId,
          status: 'approved',
        },
      });

      const campaign = await tx.campaign.update({
        where: { id: application.campaignId },
        data: {
          numberOfInfluencer: approvedCount,
        },
        select: {
          id: true,
          campaignName: true,
          numberOfInfluencer: true,
        },
      });

      return { application, campaign };
    });

    return res.status(200).json({
      success: true,
      message: 'Campaign application approved successfully',
      application: result.application,
      campaign: result.campaign,
    });
  } catch (error) {
    console.error('Approve campaign application error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while approving campaign application',
    });
  }
});

/**
 * @swagger
 * /api/admin/campaigns/{campaignId}/extend-end-date:
 *   patch:
 *     summary: Extend campaign end date (Admin only)
 *     description: Extends a campaign end date. New end date must be later than the current end date.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
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
router.patch('/campaigns/:campaignId/extend-end-date', async (req: Request, res: Response) => {
  try {
    const campaignIdParam = req.params.campaignId;
    const campaignId = Array.isArray(campaignIdParam) ? campaignIdParam[0] : campaignIdParam;
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
      where: { id: campaignId },
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
      where: { id: campaignId },
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

const queryString = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) return value[0].trim();
  return undefined;
};

/**
 * @swagger
 * /api/admin/campaign-result-images:
 *   get:
 *     summary: List campaign result images (admin)
 *     description: 'Optional filters: campaignId, influencerId, reviewStatus. Max 500 rows.'
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: campaignId
 *         schema:
 *           type: string
 *       - in: query
 *         name: influencerId
 *         schema:
 *           type: string
 *       - in: query
 *         name: reviewStatus
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *     responses:
 *       200:
 *         description: Result images listed
 *       400:
 *         description: Invalid query
 */
router.get('/campaign-result-images', async (req: Request, res: Response) => {
  try {
    const parsed = adminListCampaignResultImagesQuerySchema.safeParse({
      campaignId: queryString(req.query.campaignId),
      influencerId: queryString(req.query.influencerId),
      reviewStatus: queryString(req.query.reviewStatus),
    });

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: parsed.error.issues,
      });
    }

    const filters: {
      campaignId?: string;
      influencerId?: string;
      reviewStatus?: CampaignResultImageReviewStatus;
    } = { ...parsed.data };

    const rows = await campaignService.adminListCampaignResultImages(filters);

    return res.status(200).json({
      success: true,
      count: rows.length,
      resultImages: rows,
    });
  } catch (error) {
    console.error('Admin list campaign result images error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching campaign result images',
    });
  }
});

/**
 * @swagger
 * /api/admin/campaign-result-images/{imageId}/review:
 *   patch:
 *     summary: Review a campaign result image (admin)
 *     description: 'Set reviewStatus and reviewedResponseObject. When approved, reviewedResponseObject is required and reviewedVotes is derived from totalResponses.'
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: imageId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reviewStatus]
 *             properties:
 *               reviewStatus:
 *                 type: string
 *                 enum: [pending, approved, rejected]
 *               reviewedVotes:
 *                 type: integer
 *               reviewedResponseObject:
 *                 type: object
 *                 description: Structured votes breakdown for one question (multi_choice, yes_no, rating_scale)
 *               reviewNotes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Review saved
 *       400:
 *         description: Validation error
 *       404:
 *         description: Image not found
 */
router.patch('/campaign-result-images/:imageId/review', async (req: Request, res: Response) => {
  try {
    const imageIdParam = req.params.imageId;
    const imageId = Array.isArray(imageIdParam) ? imageIdParam[0] : imageIdParam;

    const parsed = adminReviewCampaignResultImageSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: parsed.error.issues,
      });
    }

    const adminUserId = req.user!.userId;
    const resultImage = await campaignService.adminReviewCampaignResultImage(imageId, adminUserId, parsed.data);

    return res.status(200).json({
      success: true,
      message: 'Result image review saved',
      resultImage,
    });
  } catch (error) {
    console.error('Admin review campaign result image error:', error);
    const msg = error instanceof Error ? error.message : '';
    if (msg === 'Result image not found') {
      return res.status(404).json({ success: false, message: msg });
    }
    if (
      msg === 'reviewedResponseObject is required when reviewStatus is approved'
      || msg === 'reviewedResponseObject.totalResponses must be zero or positive'
    ) {
      return res.status(400).json({ success: false, message: msg });
    }
    return res.status(500).json({
      success: false,
      message: 'An error occurred while saving the review',
    });
  }
});

export default router;
