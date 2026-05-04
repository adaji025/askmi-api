import { Router } from 'express';
import { authenticate, requireAnyRole } from '../middleware/authMiddleware.js';
import { campaignController } from '../controllers/campaignController.js';

const router = Router();

// All routes in this file require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/campaign:
 *   get:
 *     summary: Get all campaigns
 *     description: All authenticated users can view all campaigns
 *     tags: [Campaign]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Campaigns retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Campaigns retrieved successfully
 *                 campaigns:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Campaign'
 *                 count:
 *                   type: integer
 *                   example: 10
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   post:
 *     summary: Create a new campaign
 *     description: Only brands and admins can create campaigns
 *     tags: [Campaign]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCampaignRequest'
 *     responses:
 *       201:
 *         description: Campaign created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateCampaignResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Only brands and admins can create campaigns
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/', requireAnyRole('brand', 'admin'), async (req, res, next) => {
  try {
    await campaignController.create(req, res);
  } catch (error: any) {
    console.error('Route error in /campaign:', error);
    // Ensure error is properly formatted
    const err = error instanceof Error ? error : new Error(String(error));
    next(err);
  }
});

/**
 * @swagger
 * /api/campaign/{campaignId}:
 *   get:
 *     summary: Get a campaign by ID
 *     description: All authenticated users can view a specific campaign
 *     tags: [Campaign]
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Campaign retrieved successfully
 *                 campaign:
 *                   $ref: '#/components/schemas/Campaign'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Campaign not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', async (req, res, next) => {
  try {
    await campaignController.getAll(req, res);
  } catch (error: any) {
    console.error('Route error in /campaign:', error);
    const err = error instanceof Error ? error : new Error(String(error));
    next(err);
  }
});

/**
 * @swagger
 * /api/campaign/mine:
 *   get:
 *     summary: Get my campaigns (brand / admin)
 *     description: Lists only campaigns owned by the authenticated user (same full Campaign shape as other list endpoints). Brand and admin only; use GET /api/campaign for all campaigns or /user/{userId} as admin for another owner.
 *     tags: [Campaign]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Campaigns retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 count:
 *                   type: integer
 *                 campaigns:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Campaign'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — not a brand or admin
 */
router.get('/mine', requireAnyRole('brand', 'admin'), async (req, res, next) => {
  try {
    await campaignController.getMine(req, res);
  } catch (error: any) {
    console.error('Route error in /campaign/mine:', error);
    const err = error instanceof Error ? error : new Error(String(error));
    next(err);
  }
});

/**
 * @swagger
 * /api/campaign/user/{userId}:
 *   get:
 *     summary: Get campaigns by owner user id
 *     description: Admin can list any user's campaigns. Other roles only their own userId.
 *     tags: [Campaign]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign owner (user) id
 *     responses:
 *       200:
 *         description: Campaigns retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 userId:
 *                   type: string
 *                 count:
 *                   type: integer
 *                 campaigns:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Campaign'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — cannot view another user's campaigns
 */
router.get('/user/:userId', async (req, res, next) => {
  try {
    await campaignController.getByUserId(req, res);
  } catch (error: any) {
    console.error('Route error in /campaign/user/:userId:', error);
    const err = error instanceof Error ? error : new Error(String(error));
    next(err);
  }
});

/**
 * @swagger
 * /api/campaign/influencer/{campaignId}/result-images:
 *   get:
 *     summary: List my campaign result images (influencer)
 *     description: 'Approved influencers only. Images are uploaded first via POST /api/media/upload, then registered with POST .../result-images.'
 *     tags: [Campaign]
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
 *         description: Result images listed (each row includes reviewStatus, reviewedVotes, reviewNotes, reviewedAt, reviewedByAdminId when present)
 *       403:
 *         description: Not an approved influencer on this campaign
 *       404:
 *         description: Campaign not found
 *   post:
 *     summary: Register a campaign result image (influencer)
 *     description: 'Approved influencers only. Send application/json with imageUrl (and optional fileKey, caption) after POST /api/media/upload, or multipart/form-data with one image file to upload and save in one step.'
 *     tags: [Campaign]
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
 *             required: [imageUrl]
 *             properties:
 *               imageUrl:
 *                 type: string
 *                 format: uri
 *               fileKey:
 *                 type: string
 *               caption:
 *                 type: string
 *               surveyQuestionId:
 *                 type: string
 *                 description: Optional question identifier this image result belongs to
 *     responses:
 *       201:
 *         description: Result image saved
 *       400:
 *         description: Validation error or image limit reached
 *       403:
 *         description: Not an approved influencer on this campaign
 *       404:
 *         description: Campaign not found
 */
router.get('/influencer/:campaignId/result-images', requireAnyRole('influencer'), async (req, res, next) => {
  try {
    await campaignController.listInfluencerCampaignResultImages(req, res);
  } catch (error: unknown) {
    console.error('Route error in GET /campaign/influencer/:campaignId/result-images:', error);
    next(error instanceof Error ? error : new Error(String(error)));
  }
});

router.post('/influencer/:campaignId/result-images', requireAnyRole('influencer'), async (req, res, next) => {
  try {
    await campaignController.addInfluencerCampaignResultImage(req, res);
  } catch (error: unknown) {
    console.error('Route error in POST /campaign/influencer/:campaignId/result-images:', error);
    next(error instanceof Error ? error : new Error(String(error)));
  }
});

/**
 * @swagger
 * /api/campaign/influencer/{campaignId}/result-images/{imageId}:
 *   delete:
 *     summary: Remove one of my campaign result images (influencer)
 *     description: Deletes the DB row and removes the file from UploadThing when fileKey was stored.
 *     tags: [Campaign]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign ID
 *       - in: path
 *         name: imageId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Removed
 *       403:
 *         description: Not the owner of this image
 *       404:
 *         description: Image not found
 */
router.delete('/influencer/:campaignId/result-images/:imageId', requireAnyRole('influencer'), async (req, res, next) => {
  try {
    await campaignController.deleteInfluencerCampaignResultImage(req, res);
  } catch (error: unknown) {
    console.error('Route error in DELETE /campaign/influencer/:campaignId/result-images/:imageId:', error);
    next(error instanceof Error ? error : new Error(String(error)));
  }
});

/**
 * @swagger
 * /api/campaign/influencer/{campaignId}:
 *   get:
 *     summary: Get single campaign by ID (influencer)
 *     description: Influencer-only endpoint to fetch one campaign. Response includes influencerEstimatedPrice and excludes estimatedPrice.
 *     tags: [Campaign]
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
 *         description: Forbidden - Influencer role required
 *       404:
 *         description: Campaign not found
 */
router.get('/influencer/:campaignId', requireAnyRole('influencer'), async (req, res, next) => {
  try {
    await campaignController.getByIdForInfluencer(req, res);
  } catch (error: any) {
    console.error('Route error in /campaign/influencer/:campaignId:', error);
    const err = error instanceof Error ? error : new Error(String(error));
    next(err);
  }
});

/**
 * @swagger
 * /api/campaign/apply:
 *   post:
 *     summary: Apply to campaign (Influencer only)
 *     description: Influencer submits an application to join a campaign. Duplicate applications are not allowed.
 *     tags: [Campaign]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [campaignId]
 *             properties:
 *               campaignId:
 *                 type: string
 *                 example: cmabc123campaignid
 *     responses:
 *       201:
 *         description: Campaign application submitted successfully
 *       400:
 *         description: Invalid request or campaign cannot be applied to
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Influencer role required
 *       404:
 *         description: Campaign not found
 */
router.post('/apply', requireAnyRole('influencer'), async (req, res, next) => {
  try {
    await campaignController.applyToCampaign(req, res);
  } catch (error: any) {
    console.error('Route error in /campaign/apply:', error);
    const err = error instanceof Error ? error : new Error(String(error));
    next(err);
  }
});

router.get('/:campaignId', async (req, res, next) => {
  try {
    await campaignController.getById(req, res);
  } catch (error: any) {
    console.error('Route error in /campaign/:campaignId:', error);
    const err = error instanceof Error ? error : new Error(String(error));
    next(err);
  }
});

export default router;
