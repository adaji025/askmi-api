import Busboy from 'busboy';
import type { Request } from 'express';

export const MAX_SINGLE_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
export const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type ParsedMultipartImage = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
};

/**
 * Parses one image file from multipart/form-data (any field name for the first file).
 */
export function parseSingleImageUpload(req: Request): Promise<ParsedMultipartImage> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      reject(new Error('Content-Type must be multipart/form-data'));
      return;
    }

    const busboy = Busboy({
      headers: req.headers,
      limits: {
        files: 1,
        fileSize: MAX_SINGLE_IMAGE_BYTES,
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
        reject(new Error(`screenshot file is too large. Max size is ${MAX_SINGLE_IMAGE_BYTES / (1024 * 1024)}MB`));
        return;
      }
      if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
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
}
