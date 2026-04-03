import type { Request, Response } from 'express';
import { createSurveySchema, createSurveyArraySchema, updateSurveySchema, attachSurveyToCampaignSchema } from '../validators/surveyValidators.js';
import type { CreateSurveyInput } from '../validators/surveyValidators.js';
import { surveyService } from '../services/surveyService.js';

export class SurveyController {
  async create(req: Request, res: Response): Promise<void> {
    try {
      res.setHeader('Content-Type', 'application/json');

      // Support { campaignId?, title?, questions } or raw array with optional campaignId in query
      const rawBody = req.body;
      let data: CreateSurveyInput;

      if (Array.isArray(rawBody)) {
        const arrayResult = createSurveyArraySchema.safeParse(rawBody);
        if (!arrayResult.success) {
          res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: arrayResult.error.issues,
          });
          return;
        }
        const campaignId = req.query.campaignId as string | undefined;
        data = { ...arrayResult.data, ...(campaignId?.trim() ? { campaignId } : {}) };
      } else {
        const objectResult = createSurveySchema.safeParse(rawBody);
        if (!objectResult.success) {
          res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: objectResult.error.issues,
          });
          return;
        }
        data = objectResult.data;
      }
      const userId = req.user!.userId;

      const survey = await surveyService.createSurvey(data, userId);

      res.status(201).json({
        success: true,
        message: 'Survey created successfully',
        survey,
      });
    } catch (error) {
      console.error('Survey creation error:', error);
      if (!res.headersSent) {
        let statusCode = 500;
        let errorMessage = 'An error occurred during survey creation';

        if (error instanceof Error) {
          if (error.message.includes('Database connection failed')) {
            statusCode = 503;
            errorMessage = 'Database connection failed. Please try again later.';
          } else if (error.message.includes('Database setup is incomplete')) {
            statusCode = 503;
            errorMessage = error.message;
          } else if (error.message.startsWith('Failed to create survey:')) {
            errorMessage = error.message.replace('Failed to create survey: ', '');
          } else if (error.message.includes('allows nullable campaignId')) {
            statusCode = 503;
            errorMessage = error.message;
          } else {
            errorMessage = error.message;
          }
        }

        res.status(statusCode).json({
          success: false,
          message: errorMessage,
        });
      }
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      res.setHeader('Content-Type', 'application/json');

      const surveyId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const survey = await surveyService.getSurveyById(surveyId);

      if (!survey) {
        res.status(404).json({
          success: false,
          message: 'Survey not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Survey retrieved successfully',
        survey,
      });
    } catch (error) {
      console.error('Get survey error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'An error occurred while fetching the survey',
        });
      }
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      res.setHeader('Content-Type', 'application/json');

      const surveyId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const validationResult = updateSurveySchema.safeParse(req.body);

      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: validationResult.error.issues,
        });
        return;
      }

      const userId = req.user!.userId;
      const survey = await surveyService.updateSurvey(surveyId, validationResult.data, userId);

      if (!survey) {
        res.status(404).json({
          success: false,
          message: 'Survey not found or you do not have permission to edit it',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Survey updated successfully',
        survey,
      });
    } catch (error) {
      console.error('Survey update error:', error);
      if (!res.headersSent) {
        let statusCode = 500;
        let errorMessage = 'An error occurred during survey update';

        if (error instanceof Error) {
          if (error.message.includes('Database connection failed')) {
            statusCode = 503;
            errorMessage = 'Database connection failed. Please try again later.';
          } else if (error.message.includes('Database setup is incomplete')) {
            statusCode = 503;
            errorMessage = error.message;
          } else if (error.message.startsWith('Failed to update survey:')) {
            errorMessage = error.message.replace('Failed to update survey: ', '');
          }
        }

        res.status(statusCode).json({
          success: false,
          message: errorMessage,
        });
      }
    }
  }

  async getAll(req: Request, res: Response): Promise<void> {
    try {
      res.setHeader('Content-Type', 'application/json');

      const userId = req.user?.userId;
      const surveys = await surveyService.getAllSurveys(userId);

      res.status(200).json({
        success: true,
        message: 'Surveys retrieved successfully',
        surveys,
        count: surveys.length,
      });
    } catch (error) {
      console.error('Get surveys error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'An error occurred while fetching surveys',
        });
      }
    }
  }

  async attachToCampaign(req: Request, res: Response): Promise<void> {
    try {
      res.setHeader('Content-Type', 'application/json');

      const surveyId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const validationResult = attachSurveyToCampaignSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: validationResult.error.issues,
        });
        return;
      }

      const userId = req.user!.userId;
      const userRole = req.user!.role;
      const { campaignId } = validationResult.data;

      const survey = await surveyService.attachSurveyToCampaign(surveyId, campaignId, userId, userRole);

      if (!survey) {
        res.status(404).json({
          success: false,
          message: 'Survey not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Survey attached to campaign successfully',
        survey,
      });
    } catch (error) {
      console.error('Attach survey to campaign error:', error);
      if (!res.headersSent) {
        let statusCode = 500;
        let errorMessage = 'An error occurred while attaching survey to campaign';

        if (error instanceof Error) {
          if (error.message.includes('Database connection failed')) {
            statusCode = 503;
            errorMessage = 'Database connection failed. Please try again later.';
          } else if (error.message.startsWith('Failed to attach survey to campaign:')) {
            errorMessage = error.message.replace('Failed to attach survey to campaign: ', '');
            if (
              errorMessage === 'Campaign not found' ||
              errorMessage.includes('belong to your account')
            ) {
              statusCode = 400;
            }
          }
        }

        res.status(statusCode).json({
          success: false,
          message: errorMessage,
        });
      }
    }
  }
}

export const surveyController = new SurveyController();
