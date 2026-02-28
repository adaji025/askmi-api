import type { Request, Response } from 'express';
import { createCampaignSchema } from '../validators/campaignValidators.js';
import { campaignService } from '../services/campaignService.js';

export class CampaignController {
  /**
   * Create a new campaign
   * POST /api/campaign
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      // Ensure JSON content type
      res.setHeader('Content-Type', 'application/json');
      
      // Validate request body
      const validationResult = createCampaignSchema.safeParse(req.body);

      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: validationResult.error.issues,
        });
        return;
      }

      const data = validationResult.data;
      const userId = req.user!.userId;

      // Convert startDate string to Date object
      const startDate = new Date(data.startDate);

      // Create campaign
      const campaign = await campaignService.createCampaign(
        {
          ...data,
          startDate,
        },
        userId
      );

      res.status(201).json({
        success: true,
        message: 'Campaign created successfully',
        campaign,
      });
    } catch (error) {
      console.error('Campaign creation error:', error);
      // Only send response if headers haven't been sent
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'An error occurred during campaign creation',
          error: error instanceof Error ? error.message : 'Unknown error',
          ...(process.env.NODE_ENV === 'development' && error instanceof Error && { stack: error.stack }),
        });
      }
    }
  }

  /**
   * Get all campaigns
   * GET /api/campaign
   */
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      // Ensure JSON content type
      res.setHeader('Content-Type', 'application/json');
      
      const campaigns = await campaignService.getAllCampaigns();

      res.status(200).json({
        success: true,
        message: 'Campaigns retrieved successfully',
        campaigns,
        count: campaigns.length,
      });
    } catch (error) {
      console.error('Get campaigns error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'An error occurred while fetching campaigns',
          error: error instanceof Error ? error.message : 'Unknown error',
          ...(process.env.NODE_ENV === 'development' && error instanceof Error && { stack: error.stack }),
        });
      }
    }
  }

  /**
   * Get campaign by ID
   * GET /api/campaign/:id
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      // Ensure JSON content type
      res.setHeader('Content-Type', 'application/json');
      
      const campaignId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const campaign = await campaignService.getCampaignById(campaignId);

      if (!campaign) {
        res.status(404).json({
          success: false,
          message: 'Campaign not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Campaign retrieved successfully',
        campaign,
      });
    } catch (error) {
      console.error('Get campaign error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'An error occurred while fetching the campaign',
          error: error instanceof Error ? error.message : 'Unknown error',
          ...(process.env.NODE_ENV === 'development' && error instanceof Error && { stack: error.stack }),
        });
      }
    }
  }
}

export const campaignController = new CampaignController();
