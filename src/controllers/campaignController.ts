import type { Request, Response } from 'express';
import { createCampaignSchema } from '../validators/campaignValidators.js';
import { campaignService } from '../services/campaignService.js';
import { isAdmin } from '../types/permissions.js';

export class CampaignController {
  private buildInfluencerCampaignStats(
    campaigns: Array<{
      id: string;
      campaignName: string;
      description: string;
      totalVoteNeeded: number;
      isActive: boolean;
      isCompleted: boolean;
      response?: number;
      influencerEstimatedPrice?: number;
      startDate?: Date;
      endDate?: Date | null;
    }>,
  ) {
    const totalEarnings = Number(
      campaigns
        .reduce((sum, campaign) => sum + (campaign.influencerEstimatedPrice ?? 0), 0)
        .toFixed(2),
    );
    const totalVotes = campaigns.reduce((sum, campaign) => sum + (campaign.response ?? 0), 0);
    const avgVotePerSurvey = campaigns.length > 0
      ? Number((totalVotes / campaigns.length).toFixed(2))
      : 0;
    const activeCampaigns = campaigns
      .filter((campaign) => campaign.isActive && !campaign.isCompleted)
      .map((campaign) => ({
        id: campaign.id,
        campaignName: campaign.campaignName,
        description: campaign.description,
        totalVoteNeeded: campaign.totalVoteNeeded,
        response: campaign.response ?? 0,
        influencerEstimatedPrice: campaign.influencerEstimatedPrice ?? 0,
        startDate: campaign.startDate,
        endDate: campaign.endDate ?? null,
      }));

    return {
      stats: {
        totalEarnings,
        avgVotePerSurvey,
        activeCampaign: activeCampaigns.length,
      },
      activeCampaigns,
    };
  }

  private formatCampaignForRequester<T extends { estimatedPrice?: number; influencerEstimatedPrice?: number }>(
    campaign: T,
    requesterRole?: string,
  ): Omit<T, 'estimatedPrice'> | T {
    if (requesterRole !== 'influencer') {
      return campaign;
    }

    const { estimatedPrice, ...campaignWithoutEstimatedPrice } = campaign;
    return campaignWithoutEstimatedPrice;
  }

  private formatCampaignListForRequester<T extends { estimatedPrice?: number; influencerEstimatedPrice?: number }>(
    campaigns: T[],
    requesterRole?: string,
  ): Array<Omit<T, 'estimatedPrice'> | T> {
    return campaigns.map((campaign) => this.formatCampaignForRequester(campaign, requesterRole));
  }

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
      const userRole = req.user!.role;
      const numberOfQuestions = data.totalQuestions ?? data.numberOfQuestions ?? 0;

      // Convert date strings to Date objects
      const startDate = new Date(data.startDate);
      const endDate = data.endDate
        ? new Date(data.endDate)
        : new Date(startDate.getTime() + (7 * 24 * 60 * 60 * 1000));

      // Create campaign
      const campaign = await campaignService.createCampaign(
        {
          ...data,
          numberOfQuestions,
          startDate,
          endDate,
        },
        userId,
        userRole
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
        let statusCode = 500;
        let errorMessage = 'An error occurred during campaign creation';
        
        if (error instanceof Error) {
          if (error.message.includes('Database connection failed')) {
            statusCode = 503; // Service Unavailable
            errorMessage = 'Database connection failed. Please try again later.';
          } else if (error.message.includes('Database setup is incomplete')) {
            statusCode = 503; // Service Unavailable
            errorMessage = error.message;
          } else if (error.message.startsWith('Failed to create campaign:')) {
            // Forward Prisma/service error details for debugging
            errorMessage = error.message.replace('Failed to create campaign: ', '');
          }
        }
        
        res.status(statusCode).json({
          success: false,
          message: errorMessage,
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
      const formattedCampaigns = this.formatCampaignListForRequester(campaigns, req.user?.role);

      res.status(200).json({
        success: true,
        message: 'Campaigns retrieved successfully',
        campaigns: formattedCampaigns,
        count: formattedCampaigns.length,
        ...(req.user?.role === 'influencer'
          ? this.buildInfluencerCampaignStats(formattedCampaigns)
          : {}),
      });
    } catch (error) {
      console.error('Get campaigns error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'An error occurred while fetching campaigns',
        });
      }
    }
  }

  /**
   * Get campaigns for the authenticated brand / admin (own campaigns only)
   * GET /api/campaign/mine
   */
  async getMine(req: Request, res: Response): Promise<void> {
    try {
      res.setHeader('Content-Type', 'application/json');
      const userId = req.user!.userId;
      const campaigns = await campaignService.getCampaignsByUserId(userId);
      const formattedCampaigns = this.formatCampaignListForRequester(campaigns, req.user?.role);

      res.status(200).json({
        success: true,
        message: 'Campaigns retrieved successfully',
        campaigns: formattedCampaigns,
        count: formattedCampaigns.length,
      });
    } catch (error) {
      console.error('Get my campaigns error:', error);
      if (!res.headersSent) {
        let statusCode = 500;
        let errorMessage = 'An error occurred while fetching campaigns';

        if (error instanceof Error && error.message.includes('Database connection failed')) {
          statusCode = 503;
          errorMessage = 'Database connection failed. Please try again later.';
        }

        res.status(statusCode).json({
          success: false,
          message: errorMessage,
        });
      }
    }
  }

  /**
   * Get campaigns by owner user id
   * GET /api/campaign/user/:userId
   * Admin: any userId. Others: only their own userId.
   */
  async getByUserId(req: Request, res: Response): Promise<void> {
    try {
      res.setHeader('Content-Type', 'application/json');

      const userIdParam = req.params.userId;
      const userId = Array.isArray(userIdParam) ? userIdParam[0] : userIdParam;
      const requester = req.user!;

      if (!isAdmin(requester.role) && requester.userId !== userId) {
        res.status(403).json({
          success: false,
          message: 'You can only view campaigns for your own account',
        });
        return;
      }

      const campaigns = await campaignService.getCampaignsByUserId(userId);
      const formattedCampaigns = this.formatCampaignListForRequester(campaigns, req.user?.role);

      res.status(200).json({
        success: true,
        message: 'Campaigns retrieved successfully',
        campaigns: formattedCampaigns,
        count: formattedCampaigns.length,
        ...(req.user?.role === 'influencer'
          ? this.buildInfluencerCampaignStats(formattedCampaigns)
          : {}),
        userId,
      });
    } catch (error) {
      console.error('Get campaigns by userId error:', error);
      if (!res.headersSent) {
        let statusCode = 500;
        let errorMessage = 'An error occurred while fetching campaigns';

        if (error instanceof Error && error.message.includes('Database connection failed')) {
          statusCode = 503;
          errorMessage = 'Database connection failed. Please try again later.';
        }

        res.status(statusCode).json({
          success: false,
          message: errorMessage,
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
        campaign: this.formatCampaignForRequester(campaign, req.user?.role),
      });
    } catch (error) {
      console.error('Get campaign error:', error);
      if (!res.headersSent) {
        let statusCode = 500;
        let errorMessage = 'An error occurred while fetching the campaign';
        
        if (error instanceof Error && error.message.includes('Database connection failed')) {
          statusCode = 503; // Service Unavailable
          errorMessage = 'Database connection failed. Please try again later.';
        }
        
        res.status(statusCode).json({
          success: false,
          message: errorMessage,
        });
      }
    }
  }

  /**
   * Get campaign by ID for influencer
   * GET /api/campaign/influencer/:id
   */
  async getByIdForInfluencer(req: Request, res: Response): Promise<void> {
    try {
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
        campaign: this.formatCampaignForRequester(campaign, 'influencer'),
      });
    } catch (error) {
      console.error('Get influencer campaign by id error:', error);
      if (!res.headersSent) {
        let statusCode = 500;
        let errorMessage = 'An error occurred while fetching the campaign';

        if (error instanceof Error && error.message.includes('Database connection failed')) {
          statusCode = 503;
          errorMessage = 'Database connection failed. Please try again later.';
        }

        res.status(statusCode).json({
          success: false,
          message: errorMessage,
        });
      }
    }
  }
}

export const campaignController = new CampaignController();
