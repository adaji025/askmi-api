import { prisma } from '../index.js';
import type { SurveySource } from '@prisma/client';
import { isAdmin } from '../types/permissions.js';
import { DEFAULT_PRICE_PER_UNIT_VOTE } from './budgetService.js';

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
}

export const campaignService = new CampaignService();
