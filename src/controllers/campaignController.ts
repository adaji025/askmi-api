import type { Request, Response } from 'express';
import { UTApi } from 'uploadthing/server';
import { createCampaignSchema, applyToCampaignSchema, addCampaignResultImageSchema } from '../validators/campaignValidators.js';
import { campaignService } from '../services/campaignService.js';
import { isAdmin } from '../types/permissions.js';
import { parseSingleImageUpload } from '../utils/multipartSingleImage.js';

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
   * GET /api/campaign/:campaignId
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      // Ensure JSON content type
      res.setHeader('Content-Type', 'application/json');
      
      const campaignIdParam = req.params.campaignId;
      const campaignId = Array.isArray(campaignIdParam) ? campaignIdParam[0] : campaignIdParam;

      const campaign = await campaignService.getCampaignById(campaignId);

      if (!campaign) {
        res.status(404).json({
          success: false,
          message: 'Campaign not found',
        });
        return;
      }

      const formatted = this.formatCampaignForRequester(campaign, req.user?.role);
      const resultExtras = req.user
        ? await campaignService.getResultImagesForCampaignViewer(campaign.id, campaign.userId, {
            userId: req.user.userId,
            role: req.user.role,
          })
        : {};

      res.status(200).json({
        success: true,
        message: 'Campaign retrieved successfully',
        campaign: { ...formatted, ...resultExtras },
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
   * GET /api/campaign/influencer/:campaignId
   */
  async getByIdForInfluencer(req: Request, res: Response): Promise<void> {
    try {
      res.setHeader('Content-Type', 'application/json');

      const campaignIdParam = req.params.campaignId;
      const campaignId = Array.isArray(campaignIdParam) ? campaignIdParam[0] : campaignIdParam;
      const campaign = await campaignService.getCampaignById(campaignId);

      if (!campaign) {
        res.status(404).json({
          success: false,
          message: 'Campaign not found',
        });
        return;
      }

      const formatted = this.formatCampaignForRequester(campaign, 'influencer');
      const resultExtras = await campaignService.getResultImagesForCampaignViewer(campaign.id, campaign.userId, {
        userId: req.user!.userId,
        role: req.user!.role,
      });

      res.status(200).json({
        success: true,
        message: 'Campaign retrieved successfully',
        campaign: { ...formatted, ...resultExtras },
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

  /**
   * Apply to campaign as influencer
   * POST /api/campaign/apply
   */
  async applyToCampaign(req: Request, res: Response): Promise<void> {
    try {
      res.setHeader('Content-Type', 'application/json');

      const validationResult = applyToCampaignSchema.safeParse(req.body ?? {});

      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: validationResult.error.issues,
        });
        return;
      }

      const influencerId = req.user!.userId;
      const application = await campaignService.applyToCampaign(
        validationResult.data.campaignId,
        influencerId,
      );

      res.status(201).json({
        success: true,
        message: 'Campaign application submitted successfully',
        application,
      });
    } catch (error) {
      console.error('Apply to campaign error:', error);

      if (!res.headersSent) {
        const knownErrorMessage = error instanceof Error ? error.message : '';
        const knownBadRequestMessages = new Set([
          'Campaign not found',
          'You cannot apply to your own campaign',
          'Campaign is not accepting applications',
          'Campaign has ended',
          'You have already applied to this campaign',
        ]);

        if (knownErrorMessage === 'Campaign not found') {
          res.status(404).json({
            success: false,
            message: knownErrorMessage,
          });
          return;
        }

        if (knownBadRequestMessages.has(knownErrorMessage)) {
          res.status(400).json({
            success: false,
            message: knownErrorMessage,
          });
          return;
        }

        res.status(500).json({
          success: false,
          message: 'An error occurred while applying to campaign',
        });
      }
    }
  }

  /**
   * POST /api/campaign/influencer/:campaignId/result-images (and POST /api/influencer/:campaignId/result-images)
   * JSON body: imageUrl (+ optional fileKey, caption) after POST /api/media/upload, or multipart/form-data with one image file (uploads to UploadThing then saves).
   */
  async addInfluencerCampaignResultImage(req: Request, res: Response): Promise<void> {
    try {
      res.setHeader('Content-Type', 'application/json');

      const campaignIdParam = req.params.campaignId;
      const campaignId = Array.isArray(campaignIdParam) ? campaignIdParam[0] : campaignIdParam;
      const influencerId = req.user!.userId;

      const contentType = (req.headers['content-type'] || '').toLowerCase();
      let payload: { imageUrl: string; fileKey?: string; caption?: string; surveyQuestionId?: string };

      if (contentType.includes('multipart/form-data')) {
        if (!process.env.UPLOADTHING_TOKEN) {
          res.status(500).json({
            success: false,
            message: 'Server misconfiguration: UPLOADTHING_TOKEN is not set',
          });
          return;
        }

        try {
          const parsedUpload = await parseSingleImageUpload(req);
          const uploadApi = new UTApi();
          const fileBytes = Uint8Array.from(parsedUpload.buffer);
          const file = new File([fileBytes], parsedUpload.filename, { type: parsedUpload.mimeType });
          const uploadResult = await uploadApi.uploadFiles(file);

          if (!uploadResult.data?.url) {
            res.status(502).json({
              success: false,
              message: 'Failed to upload image to UploadThing',
            });
            return;
          }

          payload = {
            imageUrl: uploadResult.data.url,
            fileKey: uploadResult.data.key || undefined,
            surveyQuestionId: typeof req.query.surveyQuestionId === 'string'
              ? req.query.surveyQuestionId
              : undefined,
          };
        } catch (parseOrUploadError) {
          const message = parseOrUploadError instanceof Error ? parseOrUploadError.message : 'Invalid file payload';
          const isValidationError =
            typeof message === 'string' &&
            (message.includes('multipart/form-data') ||
              message.includes('required') ||
              message.includes('too large') ||
              message.includes('Unsupported file type'));
          res.status(isValidationError ? 400 : 500).json({
            success: false,
            message,
          });
          return;
        }
      } else {
        const validationResult = addCampaignResultImageSchema.safeParse(req.body ?? {});

        if (!validationResult.success) {
          res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: validationResult.error.issues,
            hint:
              'This endpoint expects either (1) Content-Type multipart/form-data with one image file, or (2) application/json with {"imageUrl":"…"} (URL from POST /api/media/upload). A bare file attach without multipart/form-data is treated as JSON and imageUrl will be missing.',
          });
          return;
        }

        payload = validationResult.data;
      }

      const row = await campaignService.addCampaignResultImage(campaignId, influencerId, payload);

      res.status(201).json({
        success: true,
        message: 'Result image saved successfully',
        resultImage: row,
      });
    } catch (error) {
      console.error('Add campaign result image error:', error);
      if (!res.headersSent) {
        const msg = error instanceof Error ? error.message : '';
        if (msg === 'Campaign not found') {
          res.status(404).json({ success: false, message: msg });
          return;
        }
        if (msg.startsWith('You must be an approved influencer')) {
          res.status(403).json({ success: false, message: msg });
          return;
        }
        if (msg.includes('at most') && msg.includes('result images')) {
          res.status(400).json({ success: false, message: msg });
          return;
        }
        res.status(500).json({
          success: false,
          message: 'An error occurred while saving the result image',
        });
      }
    }
  }

  /**
   * GET /api/campaign/influencer/:campaignId/result-images
   */
  async listInfluencerCampaignResultImages(req: Request, res: Response): Promise<void> {
    try {
      res.setHeader('Content-Type', 'application/json');
      const campaignIdParam = req.params.campaignId;
      const campaignId = Array.isArray(campaignIdParam) ? campaignIdParam[0] : campaignIdParam;
      const influencerId = req.user!.userId;
      const images = await campaignService.listMyCampaignResultImages(campaignId, influencerId);

      res.status(200).json({
        success: true,
        count: images.length,
        resultImages: images,
      });
    } catch (error) {
      console.error('List campaign result images error:', error);
      if (!res.headersSent) {
        const msg = error instanceof Error ? error.message : '';
        if (msg === 'Campaign not found') {
          res.status(404).json({ success: false, message: msg });
          return;
        }
        if (msg.startsWith('You must be an approved influencer')) {
          res.status(403).json({ success: false, message: msg });
          return;
        }
        res.status(500).json({
          success: false,
          message: 'An error occurred while fetching result images',
        });
      }
    }
  }

  /**
   * DELETE /api/campaign/influencer/:campaignId/result-images/:imageId
   */
  async deleteInfluencerCampaignResultImage(req: Request, res: Response): Promise<void> {
    try {
      res.setHeader('Content-Type', 'application/json');
      const imageId = Array.isArray(req.params.imageId) ? req.params.imageId[0] : req.params.imageId;
      const influencerId = req.user!.userId;

      const { fileKey } = await campaignService.deleteCampaignResultImage(imageId, influencerId);

      if (fileKey && process.env.UPLOADTHING_TOKEN) {
        try {
          const uploadApi = new UTApi();
          await uploadApi.deleteFiles(fileKey);
        } catch (uploadError) {
          console.error('UploadThing delete after DB remove:', uploadError);
        }
      }

      res.status(200).json({
        success: true,
        message: 'Result image removed',
      });
    } catch (error) {
      console.error('Delete campaign result image error:', error);
      if (!res.headersSent) {
        const msg = error instanceof Error ? error.message : '';
        if (msg === 'Result image not found') {
          res.status(404).json({ success: false, message: msg });
          return;
        }
        if (msg === 'You can only delete your own result images') {
          res.status(403).json({ success: false, message: msg });
          return;
        }
        res.status(500).json({
          success: false,
          message: 'An error occurred while deleting the result image',
        });
      }
    }
  }
}

export const campaignController = new CampaignController();
