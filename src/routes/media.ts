import { Router } from 'express';
import type { Request, Response } from 'express';
import Busboy from 'busboy';
import { UTApi } from 'uploadthing/server';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();
const MAX_MEDIA_FILE_SIZE = 8 * 1024 * 1024; // 8MB
const ALLOWED_MEDIA_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type ParsedUploadFile = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
};

const parseSingleImageUpload = (req: Request): Promise<ParsedUploadFile> =>
  new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      reject(new Error('Content-Type must be multipart/form-data'));
      return;
    }

    const busboy = Busboy({
      headers: req.headers,
      limits: {
        files: 1,
        fileSize: MAX_MEDIA_FILE_SIZE,
      },
    });

    let fileBuffer: Buffer | null = null;
    let filename = '';
    let mimeType = '';
    let gotFile = false;
    let tooLarge = false;
    const chunks: Buffer[] = [];

    busboy.on('file', (_fieldName, file, info) => {
      if (gotFile) {
        file.resume();
        return;
      }

      gotFile = true;
      filename = info.filename || 'upload';
      mimeType = info.mimeType || '';

      file.on('data', (chunk: Buffer) => chunks.push(chunk));
      file.on('limit', () => {
        tooLarge = true;
      });
      file.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    busboy.on('finish', () => {
      if (!gotFile || !fileBuffer) {
        reject(new Error('screenshot file is required'));
        return;
      }
      if (tooLarge) {
        reject(new Error(`screenshot file is too large. Max size is ${MAX_MEDIA_FILE_SIZE / (1024 * 1024)}MB`));
        return;
      }
      if (!ALLOWED_MEDIA_MIME_TYPES.has(mimeType)) {
        reject(new Error('Unsupported file type. Allowed types: image/jpeg, image/png, image/webp'));
        return;
      }
      resolve({
        buffer: fileBuffer,
        filename,
        mimeType,
      });
    });

    busboy.on('error', (error) => reject(error));
    req.pipe(busboy);
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

export default router;
