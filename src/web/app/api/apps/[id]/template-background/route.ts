/**
 * Template background upload API
 * POST /api/apps/:id/template-background - Upload custom background image
 */

import sharp from 'sharp';
import { NextRequest } from 'next/server';
import { getAppById } from '@/lib/db';
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_SIZE } from '@/lib/constants';
import { saveTemplateBackground } from '@/lib/storage';
import { successResponse, errorResponse, handleApiError, getIdFromParams } from '@/lib/api-helpers';

/**
 * POST /api/apps/:id/template-background
 * Upload and persist custom template background image
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const routeParams = await context.params;
    const appId = getIdFromParams(routeParams);

    const app = getAppById(appId);
    if (!app) {
      return errorResponse('App not found', 404);
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return errorResponse('Image file is required', 400);
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return errorResponse('Unsupported image type. Use PNG, JPG, JPEG, or WEBP.', 400);
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      return errorResponse(`Image exceeds max size (${Math.floor(MAX_UPLOAD_SIZE / (1024 * 1024))}MB).`, 400);
    }

    const inputBuffer = Buffer.from(await file.arrayBuffer());

    // Normalize to PNG so downstream rendering is deterministic.
    const pngBuffer = await sharp(inputBuffer)
      .rotate()
      .png({ quality: 95, compressionLevel: 9 })
      .toBuffer();

    const imagePath = await saveTemplateBackground(appId, pngBuffer);

    return successResponse({
      image_path: imagePath,
      image_url: `/api/uploads/${imagePath}`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
