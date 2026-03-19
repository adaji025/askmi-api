import { prisma } from '../index.js';

export interface CreateSurveyData {
  campaignId: string;
  title?: string;
  questions: Array<{
    type: 'multiple-choice' | 'yes-no' | 'rating-scale' | 'text';
    title: string;
    required: boolean;
    id: string;
    order: number;
    options?: Array<{ id: number; text: string }>;
  }>;
}

export interface SurveyResponse {
  id: string;
  title: string | null;
  questions: unknown;
  campaignId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class SurveyService {
  async createSurvey(data: CreateSurveyData, userId: string): Promise<SurveyResponse> {
    try {
      const survey = await prisma.survey.create({
        data: {
          campaignId: data.campaignId,
          title: data.title ?? null,
          questions: data.questions as object,
          userId,
        },
        select: {
          id: true,
          title: true,
          questions: true,
          campaignId: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return survey;
    } catch (error: any) {
      console.error('SurveyService.createSurvey error:', error);

      if (error?.code === 'P1001' || error?.message?.includes('getaddrinfo') || error?.message?.includes('EAI_AGAIN')) {
        throw new Error('Database connection failed. Please check your database server is running and accessible.');
      }

      if (error?.message?.includes('does not exist in the current database')) {
        throw new Error('Database setup is incomplete. Please run database migrations to create the required tables.');
      }

      const errorMessage = error?.message || 'Unknown error';
      throw new Error(`Failed to create survey: ${errorMessage}`);
    }
  }

  async getSurveyById(surveyId: string): Promise<SurveyResponse | null> {
    try {
      const survey = await prisma.survey.findUnique({
        where: { id: surveyId },
        select: {
          id: true,
          title: true,
          questions: true,
          campaignId: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return survey;
    } catch (error: any) {
      console.error('SurveyService.getSurveyById error:', error);

      if (error?.code === 'P1001' || error?.message?.includes('getaddrinfo') || error?.message?.includes('EAI_AGAIN')) {
        throw new Error('Database connection failed. Please check your database server is running and accessible.');
      }

      const errorMessage = error?.message || 'Unknown error';
      throw new Error(`Failed to fetch survey: ${errorMessage}`);
    }
  }

  async updateSurvey(
    surveyId: string,
    data: Partial<CreateSurveyData>,
    userId: string
  ): Promise<SurveyResponse | null> {
    try {
      const existing = await prisma.survey.findUnique({
        where: { id: surveyId },
      });

      if (!existing || existing.userId !== userId) {
        return null;
      }

      const survey = await prisma.survey.update({
        where: { id: surveyId },
        data: {
          ...(data.title !== undefined && { title: data.title ?? null }),
          ...(data.questions !== undefined && { questions: data.questions as object }),
        },
        select: {
          id: true,
          title: true,
          questions: true,
          campaignId: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return survey;
    } catch (error: any) {
      console.error('SurveyService.updateSurvey error:', error);

      if (error?.code === 'P1001' || error?.message?.includes('getaddrinfo') || error?.message?.includes('EAI_AGAIN')) {
        throw new Error('Database connection failed. Please check your database server is running and accessible.');
      }

      if (error?.message?.includes('does not exist in the current database')) {
        throw new Error('Database setup is incomplete. Please run database migrations to create the required tables.');
      }

      const errorMessage = error?.message || 'Unknown error';
      throw new Error(`Failed to update survey: ${errorMessage}`);
    }
  }

  async getAllSurveys(userId?: string): Promise<SurveyResponse[]> {
    try {
      const surveys = await prisma.survey.findMany({
        where: userId ? { userId } : undefined,
        select: {
          id: true,
          title: true,
          questions: true,
          campaignId: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return surveys;
    } catch (error: any) {
      console.error('SurveyService.getAllSurveys error:', error);

      if (error?.code === 'P1001' || error?.message?.includes('getaddrinfo') || error?.message?.includes('EAI_AGAIN')) {
        throw new Error('Database connection failed. Please check your database server is running and accessible.');
      }

      const errorMessage = error?.message || 'Unknown error';
      throw new Error(`Failed to fetch surveys: ${errorMessage}`);
    }
  }
}

export const surveyService = new SurveyService();
