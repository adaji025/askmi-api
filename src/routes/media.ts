import { Router } from 'express';
import type { Request, Response } from 'express';
import { UTApi } from 'uploadthing/server';
import { z } from 'zod';
import { authenticate } from '../middleware/authMiddleware.js';
import { parseSingleImageUpload } from '../utils/multipartSingleImage.js';

const router = Router();
const deleteMediaSchema = z.object({
  fileKey: z.string().min(1, 'fileKey is required'),
});

router.use(authenticate);

/**
 * @swagger
 * /api/media/upload:
 *   post:
 *     summary: Upload image to UploadThing
 *     description: |
 *       Generic image upload endpoint for all authenticated users.
 *       Uploads an image to UploadThing and returns a URL and metadata so callers can persist it in their own DB records.
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [screenshot]
 *             properties:
 *               screenshot:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Media uploaded successfully
 *       400:
 *         description: Invalid file payload
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server/upload error
 */
router.post('/upload', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    if (!process.env.UPLOADTHING_TOKEN) {
      return res.status(500).json({
        success: false,
        message: 'Server misconfiguration: UPLOADTHING_TOKEN is not set',
      });
    }

    const parsedUpload = await parseSingleImageUpload(req);
    const uploadApi = new UTApi();
    const fileBytes = Uint8Array.from(parsedUpload.buffer);
    const file = new File([fileBytes], parsedUpload.filename, { type: parsedUpload.mimeType });
    const uploadResult = await uploadApi.uploadFiles(file);

    if (!uploadResult.data?.url) {
      return res.status(502).json({
        success: false,
        message: 'Failed to upload image to UploadThing',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Media uploaded successfully',
      media: {
        url: uploadResult.data.url,
        key: uploadResult.data.key || null,
        name: uploadResult.data.name || parsedUpload.filename,
      },
    });
  } catch (error) {
    console.error('Upload media error:', error);
    const message = error instanceof Error ? error.message : 'An error occurred while uploading media';
    const isValidationError =
      typeof message === 'string' &&
      (message.includes('multipart/form-data') ||
        message.includes('required') ||
        message.includes('too large') ||
        message.includes('Unsupported file type'));

    return res.status(isValidationError ? 400 : 500).json({
      success: false,
      message,
    });
  }
});

/**
 * @swagger
 * /api/media/delete:
 *   post:
 *     summary: Delete media from UploadThing
 *     description: |
 *       Deletes a previously uploaded file from UploadThing using its file key.
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fileKey]
 *             properties:
 *               fileKey:
 *                 type: string
 *                 example: 4f76b394-acde-42da-b9a8-123456789abc-poll-proof.png
 *     responses:
 *       200:
 *         description: Media deleted successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server/delete error
 */
router.post('/delete', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    if (!process.env.UPLOADTHING_TOKEN) {
      return res.status(500).json({
        success: false,
        message: 'Server misconfiguration: UPLOADTHING_TOKEN is not set',
      });
    }

    const validationResult = deleteMediaSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validationResult.error.issues,
      });
    }

    const uploadApi = new UTApi();
    await uploadApi.deleteFiles(validationResult.data.fileKey);

    return res.status(200).json({
      success: true,
      message: 'Media deleted successfully',
      fileKey: validationResult.data.fileKey,
    });
  } catch (error) {
    console.error('Delete media error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while deleting media',
    });
  }
});

export default router;
