import { prisma } from '../index.js';
import type { CampaignResultImageReviewStatus, SurveySource } from '@prisma/client';
import { isAdmin } from '../types/permissions.js';
import { DEFAULT_PRICE_PER_UNIT_VOTE } from './budgetService.js';

const MAX_CAMPAIGN_RESULT_IMAGES_PER_INFLUENCER = 20;

export interface CreateCampaignData {
  campaignName: string;
  description: string;
  surveySource: SurveySource;
  surveyId?: string;
  targetAudience: {
    region: { type: 'all' | 'custom'; values?: string[] };
    city: { type: 'all' | 'custom'; values?: string[] };
    age: { type: 'all' | 'custom'; values?: string[] };
    interest: { type: 'all' | 'custom'; values?: string[] };
  };
  totalVoteNeeded: number;
  numberOfQuestions?: number;
  startDate: Date;
  endDate?: Date | null;
}

export interface CampaignWithoutRelations {
  id: string;
  campaignName: string;
  description: string;
  surveySource: SurveySource;
  targetAudience: any;
  totalVoteNeeded: number;
  numberOfQuestions: number;
  totalQuestions: number;
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
  isCompleted: boolean;
  numberOfInfluencer: number;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignWithResponse extends CampaignWithoutRelations {
  surveys?: { id: string; title: string | null; questions: unknown }[];
  response: number; // Total votes received from surveys associated with the campaign
  estimatedPrice: number;
  influencerEstimatedPrice: number;
}

export interface CampaignApplicationResult {
  id: string;
  campaignId: string;
  influencerId: string;
  status: 'pending' | 'approved' | 'rejected';
  message: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignResultImageRow {
  id: string;
  campaignId: string;
  influencerId: string;
  surveyQuestionId: string | null;
  imageUrl: string;
  fileKey: string | null;
  caption: string | null;
  reviewStatus: CampaignResultImageReviewStatus;
  reviewedVotes: number | null;
  reviewedResponseObject: unknown | null;
  reviewNotes: string | null;
  reviewedByAdminId: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CampaignResultImageForViewer = {
  id: string;
  influencerId: string;
  surveyQuestionId: string | null;
  influencerName?: string;
  imageUrl: string;
  caption: string | null;
  createdAt: Date;
  reviewStatus: CampaignResultImageReviewStatus;
  reviewedVotes: number | null;
  reviewedResponseObject: unknown | null;
  reviewNotes: string | null;
  reviewedAt: Date | null;
  reviewedByAdminId: string | null;
  reviewerName?: string | null;
};

export type AdminCampaignResultImageListRow = CampaignResultImageRow & {
  influencer: { id: string; fullName: string; email: string };
  reviewedByAdmin: { id: string; fullName: string; email: string } | null;
  campaign: { id: string; campaignName: string };
};

type CampaignResultImageReviewObject =
  | {
    questionType: 'multi_choice';
    options: Array<{ optionText?: string; votes: number }>;
  }
  | {
    questionType: 'yes_no';
    votesByYesOrNo: {
      yesVotes: number;
      noVotes: number;
    };
  }
  | {
    questionType: 'rating_scale';
    votesByRating: Record<string, number>;
  };

type StoredReviewEnvelope = {
  note: string | null;
  responseObject: CampaignResultImageReviewObject | null;
};

const decodeReviewEnvelope = (value: string | null): StoredReviewEnvelope => {
  if (!value) {
    return { note: null, responseObject: null };
  }
  try {
    const parsed = JSON.parse(value) as Partial<StoredReviewEnvelope>;
    return {
      note: typeof parsed.note === 'string' || parsed.note === null ? (parsed.note ?? null) : null,
      responseObject: (parsed.responseObject as CampaignResultImageReviewObject | null) ?? null,
    };
  } catch {
    return { note: value, responseObject: null };
  }
};

const deriveTotalResponses = (reviewObject: CampaignResultImageReviewObject): number => {
  if (reviewObject.questionType === 'multi_choice') {
    return reviewObject.options.reduce((sum, option) => sum + option.votes, 0);
  }
  if (reviewObject.questionType === 'yes_no') {
    return reviewObject.votesByYesOrNo.yesVotes + reviewObject.votesByYesOrNo.noVotes;
  }
  return Object.values(reviewObject.votesByRating).reduce((sum, count) => sum + count, 0);
};

export class CampaignService {
  private async getCurrentPricePerUnitVote(): Promise<number> {
    const config = await prisma.budgetConfig.findUnique({
      where: { key: 'default' },
      select: { pricePerUnitVote: true },
    });

    return config ? Number(config.pricePerUnitVote) : DEFAULT_PRICE_PER_UNIT_VOTE;
  }

  private calculateEstimatedPrice(totalVoteNeeded: number, numberOfQuestions: number, pricePerUnitVote: number): number {
    return Number((totalVoteNeeded * numberOfQuestions * pricePerUnitVote).toFixed(2));
  }

  private calculateInfluencerEstimatedPrice(estimatedPrice: number): number {
    return Number((estimatedPrice * 0.5).toFixed(2));
  }

  private withTotalQuestions<T extends { numberOfQuestions: number }>(campaign: T): T & { totalQuestions: number } {
    return {
      ...campaign,
      totalQuestions: campaign.numberOfQuestions,
    };
  }

  /**
   * Create a new campaign
   */
  async createCampaign(data: CreateCampaignData, userId: string, userRole?: string): Promise<CampaignWithoutRelations> {
    try {
      const campaign = await prisma.$transaction(async (tx) => {
        const createdCampaign = await tx.campaign.create({
          data: {
            campaignName: data.campaignName,
            description: data.description,
            surveySource: data.surveySource,
            targetAudience: data.targetAudience as any,
            totalVoteNeeded: data.totalVoteNeeded,
            numberOfQuestions: data.numberOfQuestions ?? 0,
            startDate: data.startDate,
            endDate: data.endDate ?? null,
            isActive: true, // Default to true for new campaigns
            userId,
          },
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
          },
        });

        if (data.surveySource === 'use_existing_survey' && data.surveyId) {
          const existingSurvey = await tx.survey.findUnique({
            where: { id: data.surveyId },
            select: { id: true, userId: true },
          });

          if (!existingSurvey) {
            throw new Error('Selected survey was not found');
          }

          const requesterIsAdmin = !!userRole && isAdmin(userRole);
          if (!requesterIsAdmin && existingSurvey.userId !== userId) {
            throw new Error('You can only attach surveys that belong to your account');
          }

          await tx.survey.update({
            where: { id: data.surveyId },
            data: { campaignId: createdCampaign.id },
          });
        }

        return createdCampaign;
      });

      return this.withTotalQuestions(campaign);
    } catch (error: any) {
      console.error('CampaignService.createCampaign error:', error);
      
      // Handle database connection errors
      if (error?.code === 'P1001' || error?.message?.includes('getaddrinfo') || error?.message?.includes('EAI_AGAIN')) {
        throw new Error('Database connection failed. Please check your database server is running and accessible.');
      }
      
      // Handle missing table (migrations not run)
      if (error?.message?.includes('does not exist in the current database')) {
        throw new Error('Database setup is incomplete. Please run database migrations to create the required tables.');
      }
      
      // Re-throw with more context
      const errorMessage = error?.message || 'Unknown error';
      const prismaError = new Error(`Failed to create campaign: ${errorMessage}`);
      
      // Preserve Prisma error codes if available
      if (error?.code) {
        (prismaError as any).code = error.code;
      }
      
      throw prismaError;
    }
  }

  private async enrichCampaignsWithResponseCount<T extends { id: string; numberOfQuestions: number }>(
    campaigns: (T & { totalVoteNeeded: number })[],
    pricePerUnitVote: number,
  ): Promise<(T & {
    response: number;
    totalQuestions: number;
    estimatedPrice: number;
    influencerEstimatedPrice: number;
  })[]> {
    const campaignIds = campaigns.map((c) => c.id);
    const counts = await prisma.surveyResponse.groupBy({
      by: ['campaignId'],
      where: { campaignId: { in: campaignIds } },
      _count: { id: true },
    });
    const countMap = new Map(counts.map((c) => [c.campaignId, c._count.id]));
    return campaigns.map((c) => {
      const estimatedPrice = this.calculateEstimatedPrice(c.totalVoteNeeded, c.numberOfQuestions, pricePerUnitVote);
      return {
        ...c,
        response: countMap.get(c.id) ?? 0,
        totalQuestions: c.numberOfQuestions,
        estimatedPrice,
        influencerEstimatedPrice: this.calculateInfluencerEstimatedPrice(estimatedPrice),
      };
    });
  }

  /**
   * Get campaigns owned by a user (same shape as getAllCampaigns)
   */
  async getCampaignsByUserId(userId: string): Promise<CampaignWithResponse[]> {
    try {
      const campaigns = await prisma.campaign.findMany({
        where: { userId },
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
            select: { id: true, title: true, questions: true },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (campaigns.length === 0) {
        return [];
      }

      const pricePerUnitVote = await this.getCurrentPricePerUnitVote();
      return this.enrichCampaignsWithResponseCount(campaigns, pricePerUnitVote);
    } catch (error: any) {
      console.error('CampaignService.getCampaignsByUserId error:', error);

      if (error?.code === 'P1001' || error?.message?.includes('getaddrinfo') || error?.message?.includes('EAI_AGAIN')) {
        throw new Error('Database connection failed. Please check your database server is running and accessible.');
      }

      const errorMessage = error?.message || 'Unknown error';
      const prismaError = new Error(`Failed to fetch campaigns: ${errorMessage}`);
      if (error?.code) {
        (prismaError as any).code = error.code;
      }
      throw prismaError;
    }
  }

  /**
   * Get all campaigns (with response = total vote count)
   */
  async getAllCampaigns(): Promise<CampaignWithResponse[]> {
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
            select: { id: true, title: true, questions: true },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      const pricePerUnitVote = await this.getCurrentPricePerUnitVote();
      return this.enrichCampaignsWithResponseCount(campaigns, pricePerUnitVote);
    } catch (error: any) {
      console.error('CampaignService.getAllCampaigns error:', error);
      
      // Handle database connection errors
      if (error?.code === 'P1001' || error?.message?.includes('getaddrinfo') || error?.message?.includes('EAI_AGAIN')) {
        throw new Error('Database connection failed. Please check your database server is running and accessible.');
      }
      
      const errorMessage = error?.message || 'Unknown error';
      const prismaError = new Error(`Failed to fetch campaigns: ${errorMessage}`);
      if (error?.code) {
        (prismaError as any).code = error.code;
      }
      throw prismaError;
    }
  }

  /**
   * Get campaign by ID (with response = total vote count)
   */
  async getCampaignById(campaignId: string): Promise<CampaignWithResponse | null> {
    try {
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
            select: { id: true, title: true, questions: true },
          },
        },
      });

      if (!campaign) return null;
      const pricePerUnitVote = await this.getCurrentPricePerUnitVote();
      const [enriched] = await this.enrichCampaignsWithResponseCount([campaign], pricePerUnitVote);
      return enriched;
    } catch (error: any) {
      console.error('CampaignService.getCampaignById error:', error);
      
      // Handle database connection errors
      if (error?.code === 'P1001' || error?.message?.includes('getaddrinfo') || error?.message?.includes('EAI_AGAIN')) {
        throw new Error('Database connection failed. Please check your database server is running and accessible.');
      }
      
      const errorMessage = error?.message || 'Unknown error';
      const prismaError = new Error(`Failed to fetch campaign: ${errorMessage}`);
      if (error?.code) {
        (prismaError as any).code = error.code;
      }
      throw prismaError;
    }
  }

  async applyToCampaign(campaignId: string, influencerId: string): Promise<CampaignApplicationResult> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        userId: true,
        isActive: true,
        isCompleted: true,
        endDate: true,
      },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.userId === influencerId) {
      throw new Error('You cannot apply to your own campaign');
    }

    if (!campaign.isActive || campaign.isCompleted) {
      throw new Error('Campaign is not accepting applications');
    }

    if (campaign.endDate && campaign.endDate < new Date()) {
      throw new Error('Campaign has ended');
    }

    const existingApplication = await prisma.campaignApplication.findUnique({
      where: {
        campaignId_influencerId: {
          campaignId,
          influencerId,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingApplication) {
      throw new Error('You have already applied to this campaign');
    }

    const application = await prisma.campaignApplication.create({
      data: {
        campaignId,
        influencerId,
        message: null,
      },
      select: {
        id: true,
        campaignId: true,
        influencerId: true,
        status: true,
        message: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      ...application,
      status: application.status as 'pending' | 'approved' | 'rejected',
    };
  }

  private async assertApprovedInfluencerForCampaign(campaignId: string, influencerId: string): Promise<void> {
    const application = await prisma.campaignApplication.findUnique({
      where: {
        campaignId_influencerId: {
          campaignId,
          influencerId,
        },
      },
      select: { status: true },
    });
    if (!application || application.status !== 'approved') {
      throw new Error('You must be an approved influencer on this campaign to manage result images');
    }
  }

  async addCampaignResultImage(
    campaignId: string,
    influencerId: string,
    input: { imageUrl: string; fileKey?: string; caption?: string; surveyQuestionId?: string },
  ): Promise<CampaignResultImageRow> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true },
    });
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    await this.assertApprovedInfluencerForCampaign(campaignId, influencerId);

    const existingCount = await prisma.campaignResultImage.count({
      where: { campaignId, influencerId },
    });
    if (existingCount >= MAX_CAMPAIGN_RESULT_IMAGES_PER_INFLUENCER) {
      throw new Error(
        `You can upload at most ${MAX_CAMPAIGN_RESULT_IMAGES_PER_INFLUENCER} result images per campaign`,
      );
    }

    return prisma.campaignResultImage.create({
      data: {
        campaignId,
        influencerId,
        surveyQuestionId: input.surveyQuestionId ?? null,
        imageUrl: input.imageUrl,
        fileKey: input.fileKey ?? null,
        caption: input.caption ?? null,
        reviewStatus: 'pending',
      },
    });
  }

  async listMyCampaignResultImages(campaignId: string, influencerId: string): Promise<CampaignResultImageRow[]> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true },
    });
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    await this.assertApprovedInfluencerForCampaign(campaignId, influencerId);

    return prisma.campaignResultImage.findMany({
      where: { campaignId, influencerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Returns fileKey when the row had one (caller may delete from UploadThing). */
  async deleteCampaignResultImage(imageId: string, influencerId: string): Promise<{ fileKey: string | null }> {
    const row = await prisma.campaignResultImage.findUnique({
      where: { id: imageId },
      select: { id: true, influencerId: true, fileKey: true },
    });
    if (!row) {
      throw new Error('Result image not found');
    }
    if (row.influencerId !== influencerId) {
      throw new Error('You can only delete your own result images');
    }

    await prisma.campaignResultImage.delete({ where: { id: imageId } });
    return { fileKey: row.fileKey };
  }

  /**
   * Extra fields merged onto campaign JSON for GET by id.
   * Admin or campaign owner sees all influencers' images; approved influencers see only their own as `myResultImages`.
   */
  async getResultImagesForCampaignViewer(
    campaignId: string,
    campaignOwnerUserId: string,
    viewer: { userId: string; role: string },
  ): Promise<{ resultImages?: CampaignResultImageForViewer[]; myResultImages?: CampaignResultImageForViewer[] }> {
    if (isAdmin(viewer.role) || (viewer.role === 'brand' && viewer.userId === campaignOwnerUserId)) {
      const rows = await prisma.campaignResultImage.findMany({
        where: { campaignId },
        orderBy: [{ influencerId: 'asc' }, { createdAt: 'desc' }],
        select: {
          id: true,
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
          influencer: { select: { fullName: true } },
          reviewedByAdmin: { select: { fullName: true } },
        },
      });
      return {
        resultImages: rows.map((row) => {
          const decoded = decodeReviewEnvelope(row.reviewNotes);
          return {
            id: row.id,
            influencerId: row.influencerId,
            surveyQuestionId: row.surveyQuestionId,
            influencerName: row.influencer.fullName,
            imageUrl: row.imageUrl,
            caption: row.caption,
            createdAt: row.createdAt,
            reviewStatus: row.reviewStatus,
            reviewedVotes: row.reviewedVotes,
            reviewedResponseObject: decoded.responseObject,
            reviewNotes: decoded.note,
            reviewedAt: row.reviewedAt,
            reviewedByAdminId: row.reviewedByAdminId,
            reviewerName: row.reviewedByAdmin?.fullName ?? null,
          };
        }),
      };
    }

    if (viewer.role === 'influencer') {
      const application = await prisma.campaignApplication.findUnique({
        where: {
          campaignId_influencerId: {
            campaignId,
            influencerId: viewer.userId,
          },
        },
        select: { status: true },
      });
      if (!application || application.status !== 'approved') {
        return {};
      }

      const rows = await prisma.campaignResultImage.findMany({
        where: { campaignId, influencerId: viewer.userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
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
          reviewedByAdmin: { select: { fullName: true } },
        },
      });
      return {
        myResultImages: rows.map((row) => {
          const decoded = decodeReviewEnvelope(row.reviewNotes);
          return {
            id: row.id,
            influencerId: row.influencerId,
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
            reviewerName: row.reviewedByAdmin?.fullName ?? null,
          };
        }),
      };
    }

    return {};
  }

  async adminListCampaignResultImages(filters: {
    campaignId?: string;
    influencerId?: string;
    reviewStatus?: CampaignResultImageReviewStatus;
  }): Promise<AdminCampaignResultImageListRow[]> {
    const where: {
      campaignId?: string;
      influencerId?: string;
      reviewStatus?: CampaignResultImageReviewStatus;
    } = {};
    if (filters.campaignId) where.campaignId = filters.campaignId;
    if (filters.influencerId) where.influencerId = filters.influencerId;
    if (filters.reviewStatus) where.reviewStatus = filters.reviewStatus;

    const rows = await prisma.campaignResultImage.findMany({
      where,
      take: 500,
      orderBy: [{ campaignId: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        campaignId: true,
        influencerId: true,
        surveyQuestionId: true,
        imageUrl: true,
        fileKey: true,
        caption: true,
        reviewStatus: true,
        reviewedVotes: true,
        reviewNotes: true,
        reviewedByAdminId: true,
        reviewedAt: true,
        createdAt: true,
        updatedAt: true,
        influencer: { select: { id: true, fullName: true, email: true } },
        reviewedByAdmin: { select: { id: true, fullName: true, email: true } },
        campaign: { select: { id: true, campaignName: true } },
      },
    });

    return rows.map((row) => {
      const decoded = decodeReviewEnvelope(row.reviewNotes);
      return {
        ...row,
        reviewNotes: decoded.note,
        reviewedResponseObject: decoded.responseObject,
        influencer: row.influencer,
        reviewedByAdmin: row.reviewedByAdmin,
        campaign: row.campaign,
      };
    });
  }

  async adminReviewCampaignResultImage(
    imageId: string,
    adminUserId: string,
    input: {
      reviewStatus: CampaignResultImageReviewStatus;
      reviewedVotes?: number | null;
      reviewedResponseObject?: CampaignResultImageReviewObject | null;
      reviewNotes?: string | null;
    },
  ): Promise<CampaignResultImageRow> {
    const existing = await prisma.campaignResultImage.findUnique({
      where: { id: imageId },
      select: { id: true },
    });
    if (!existing) {
      throw new Error('Result image not found');
    }

    let reviewedVotes: number | null = null;
    let reviewedResponseObject: CampaignResultImageReviewObject | null = null;
    let reviewNotes: string | null = input.reviewNotes ?? null;
    const now = new Date();

    if (input.reviewStatus === 'approved') {
      if (!input.reviewedResponseObject) {
        throw new Error('reviewedResponseObject is required when reviewStatus is approved');
      }
      reviewedResponseObject = input.reviewedResponseObject;
      reviewedVotes = deriveTotalResponses(input.reviewedResponseObject);
    } else if (input.reviewStatus === 'rejected') {
      reviewedVotes = null;
      reviewedResponseObject = null;
    } else {
      reviewedVotes = null;
      reviewedResponseObject = null;
    }

    return prisma.campaignResultImage.update({
      where: { id: imageId },
      data: {
        reviewStatus: input.reviewStatus,
        reviewedVotes,
        reviewNotes: JSON.stringify({
          note: reviewNotes,
          responseObject: reviewedResponseObject,
        } satisfies StoredReviewEnvelope),
        reviewedByAdminId: adminUserId,
        reviewedAt: now,
      },
    });
  }

}

export const campaignService = new CampaignService();
