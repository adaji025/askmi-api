import { prisma } from '../index.js';
import type { SurveySource } from '@prisma/client';

export interface CreateCampaignData {
  campaignName: string;
  description: string;
  surveySource: SurveySource;
  surveyId?: string | null;
  targetAudience: {
    region: { type: 'all' | 'custom'; values?: string[] };
    city: { type: 'all' | 'custom'; values?: string[] };
    age: { type: 'all' | 'custom'; values?: string[] };
    interest: { type: 'all' | 'custom'; values?: string[] };
  };
  totalVoteNeeded: number;
  startDate: Date;
}

export interface CampaignWithoutRelations {
  id: string;
  campaignName: string;
  description: string;
  surveySource: SurveySource;
  surveyId: string | null;
  targetAudience: any;
  totalVoteNeeded: number;
  startDate: Date;
  isActive: boolean;
  isCompleted: boolean;
  numberOfInfluencer: number;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class CampaignService {
  /**
   * Create a new campaign
   */
  async createCampaign(data: CreateCampaignData, userId: string): Promise<CampaignWithoutRelations> {
    try {
      const campaign = await prisma.campaign.create({
        data: {
          campaignName: data.campaignName,
          description: data.description,
          surveySource: data.surveySource,
          surveyId: data.surveyId || null,
          targetAudience: data.targetAudience as any,
          totalVoteNeeded: data.totalVoteNeeded,
          startDate: data.startDate,
          isActive: true, // Default to true for new campaigns
          userId,
        },
        select: {
          id: true,
          campaignName: true,
          description: true,
          surveySource: true,
          surveyId: true,
          targetAudience: true,
          totalVoteNeeded: true,
          startDate: true,
          isActive: true,
          isCompleted: true,
          numberOfInfluencer: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return campaign;
    } catch (error: any) {
      console.error('CampaignService.createCampaign error:', error);
      
      // Handle database connection errors
      if (error?.code === 'P1001' || error?.message?.includes('getaddrinfo') || error?.message?.includes('EAI_AGAIN')) {
        throw new Error('Database connection failed. Please check your database server is running and accessible.');
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

  /**
   * Get all campaigns
   */
  async getAllCampaigns(): Promise<CampaignWithoutRelations[]> {
    try {
      const campaigns = await prisma.campaign.findMany({
        select: {
          id: true,
          campaignName: true,
          description: true,
          surveySource: true,
          surveyId: true,
          targetAudience: true,
          totalVoteNeeded: true,
          startDate: true,
          isActive: true,
          isCompleted: true,
          numberOfInfluencer: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return campaigns;
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
   * Get campaign by ID
   */
  async getCampaignById(campaignId: string): Promise<CampaignWithoutRelations | null> {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: {
          id: true,
          campaignName: true,
          description: true,
          surveySource: true,
          surveyId: true,
          targetAudience: true,
          totalVoteNeeded: true,
          startDate: true,
          isActive: true,
          isCompleted: true,
          numberOfInfluencer: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return campaign;
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
