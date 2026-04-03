import { Router } from 'express';
import { authenticate, requireAnyRole } from '../middleware/authMiddleware.js';
import { surveyController } from '../controllers/surveyController.js';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /api/survey:
 *   get:
 *     summary: Get all surveys
 *     description: Returns surveys for the authenticated user
 *     tags: [Survey]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Surveys retrieved successfully
 *       401:
 *         description: Unauthorized
 *   post:
 *     summary: Create a new survey
 *     description: Create a survey with questions. Body can be an object with optional title and questions array, or a raw array of questions.
 *     tags: [Survey]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - $ref: '#/components/schemas/CreateSurveyRequest'
 *               - type: array
 *                 items:
 *                   $ref: '#/components/schemas/SurveyQuestion'
 *     responses:
 *       201:
 *         description: Survey created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/', requireAnyRole('brand', 'admin'), async (req, res, next) => {
  try {
    await surveyController.create(req, res);
  } catch (error: any) {
    console.error('Route error in /survey:', error);
    next(error instanceof Error ? error : new Error(String(error)));
  }
});

router.get('/', async (req, res, next) => {
  try {
    await surveyController.getAll(req, res);
  } catch (error: any) {
    console.error('Route error in /survey:', error);
    next(error instanceof Error ? error : new Error(String(error)));
  }
});

/**
 * @swagger
 * /api/survey/{id}:
 *   get:
 *     summary: Get survey by ID
 *     tags: [Survey]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Survey retrieved successfully
 *       404:
 *         description: Survey not found
 *       401:
 *         description: Unauthorized
 *   put:
 *     summary: Update a survey
 *     description: Update survey title and/or questions. Only the survey owner can update.
 *     tags: [Survey]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateSurveyRequest'
 *     responses:
 *       200:
 *         description: Survey updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Survey not found or no permission
 *       401:
 *         description: Unauthorized
 */
router.put('/:id', requireAnyRole('brand', 'admin'), async (req, res, next) => {
  try {
    await surveyController.update(req, res);
  } catch (error: any) {
    console.error('Route error in /survey/:id PUT:', error);
    next(error instanceof Error ? error : new Error(String(error)));
  }
});

/**
 * @swagger
 * /api/survey/{id}/attach-campaign:
 *   patch:
 *     summary: Attach survey to campaign
 *     description: Attaches an existing survey to a campaign. Brand can only attach own survey to own campaign; admin can attach any.
 *     tags: [Survey]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Survey ID
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
 *     responses:
 *       200:
 *         description: Survey attached to campaign successfully
 *       400:
 *         description: Validation error or invalid ownership
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Survey not found
 */
router.patch('/:id/attach-campaign', requireAnyRole('brand', 'admin'), async (req, res, next) => {
  try {
    await surveyController.attachToCampaign(req, res);
  } catch (error: any) {
    console.error('Route error in /survey/:id/attach-campaign PATCH:', error);
    next(error instanceof Error ? error : new Error(String(error)));
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    await surveyController.getById(req, res);
  } catch (error: any) {
    console.error('Route error in /survey/:id:', error);
    next(error instanceof Error ? error : new Error(String(error)));
  }
});

export default router;
