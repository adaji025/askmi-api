import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

const verifyPollPayloadSchema = z.object({
  screenshotUrl: z.string().url('screenshotUrl must be a valid URL'),
  fileKey: z.string().min(1).optional(),
  fileName: z.string().min(1).optional(),
});

router.use(authenticate);

/**
 * @swagger
 * /api/influencer/verify-poll:
 *   post:
 *     summary: Submit or update influencer poll verification
 *     description: |
 *       Saves the uploaded poll screenshot URL for admin review.
 *       Call `/api/media/upload` first, then pass the returned `media.url` as `screenshotUrl`.
 *     tags: [Influencer Verification]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [screenshotUrl]
 *             properties:
 *               screenshotUrl:
 *                 type: string
 *                 format: uri
 *                 example: https://utfs.io/f/4f76b394-acde-42da-b9a8-123456789abc-poll-proof.png
 *               fileKey:
 *                 type: string
 *                 example: 4f76b394-acde-42da-b9a8-123456789abc-poll-proof.png
 *               fileName:
 *                 type: string
 *                 example: poll-proof.png
 *     responses:
 *       200:
 *         description: Poll verification submitted successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only influencers can submit poll verification
 */
router.post('/verify-poll', async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'influencer') {
      return res.status(403).json({
        success: false,
        message: 'Only influencers can submit poll verification',
      });
    }

    const validationResult = verifyPollPayloadSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validationResult.error.issues,
      });
    }

    const submission = await prisma.pollVerification.upsert({
      where: { userId: req.user.userId },
      update: {
        screenshotUrl: validationResult.data.screenshotUrl,
        instagramHandle: validationResult.data.fileName || null,
        notes: validationResult.data.fileKey || null,
        status: 'submitted',
        reviewNotes: null,
        reviewedAt: null,
        submittedAt: new Date(),
      },
      create: {
        userId: req.user.userId,
        screenshotUrl: validationResult.data.screenshotUrl,
        instagramHandle: validationResult.data.fileName || null,
        notes: validationResult.data.fileKey || null,
        status: 'submitted',
      },
      select: {
        id: true,
        userId: true,
        screenshotUrl: true,
        instagramHandle: true,
        notes: true,
        status: true,
        reviewNotes: true,
        submittedAt: true,
        reviewedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Poll verification submitted successfully',
      verification: submission,
    });
  } catch (error) {
    console.error('Verify poll submission error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while submitting poll verification',
    });
  }
});

/**
 * @swagger
 * /api/influencer/verify-poll/status:
 *   get:
 *     summary: Get influencer poll verification status
 *     description: Returns the authenticated influencer's latest poll verification submission.
 *     tags: [Influencer Verification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Poll verification status fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only influencers can view poll verification status
 *       404:
 *         description: Poll verification not found
 */
router.get('/verify-poll/status', async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'influencer') {
      return res.status(403).json({
        success: false,
        message: 'Only influencers can view poll verification status',
      });
    }

    const verification = await prisma.pollVerification.findUnique({
      where: { userId: req.user.userId },
      select: {
        id: true,
        userId: true,
        screenshotUrl: true,
        instagramHandle: true,
        notes: true,
        status: true,
        reviewNotes: true,
        submittedAt: true,
        reviewedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!verification) {
      return res.status(404).json({
        success: false,
        message: 'Poll verification not found',
      });
    }

    return res.status(200).json({
      success: true,
      verification,
    });
  } catch (error) {
    console.error('Get verify poll status error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching poll verification status',
    });
  }
});

export default router;
