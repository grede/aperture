/**
 * Screens API routes
 * POST /api/apps/:id/screens - Add a screen to an app (with file upload)
 */

import { NextRequest } from 'next/server';
import {
  createScreen,
  createScreenVariant,
  getAppById,
  getDb,
  getScreenById,
  getScreenVariantByScreenIdAndDeviceType,
  upsertCopy,
} from '@/lib/db';
import { saveUpload } from '@/lib/storage';
import { createScreenSchema, deviceTypeSchema } from '@/lib/validators';
import {
  successResponse,
  errorResponse,
  handleApiError,
  getIdFromParams,
} from '@/lib/api-helpers';

/**
 * POST /api/apps/:id/screens
 * Add a new screen or attach a device variant to an existing screen
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const routeParams = await context.params;
    const appId = getIdFromParams(routeParams);

    // Verify app exists
    const app = getAppById(appId);
    if (!app) {
      return errorResponse('App not found', 404);
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const rawDeviceType = formData.get('deviceType') as string;
    const rawScreenId = formData.get('screenId');

    if (!file) {
      return errorResponse('Screenshot file is required', 400);
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return errorResponse('File must be an image', 400);
    }

    const deviceType = deviceTypeSchema.parse(rawDeviceType);

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Add variant to an existing screen
    if (typeof rawScreenId === 'string' && rawScreenId.trim().length > 0) {
      const screenId = Number.parseInt(rawScreenId, 10);
      if (!Number.isFinite(screenId) || screenId <= 0) {
        return errorResponse('Invalid screenId', 400);
      }

      const existingScreen = getScreenById(screenId);
      if (!existingScreen || existingScreen.app_id !== appId) {
        return errorResponse('Screen not found', 404);
      }

      const existingVariant = getScreenVariantByScreenIdAndDeviceType(screenId, deviceType);
      if (existingVariant) {
        return errorResponse('This screen already has a screenshot for the selected device type', 409);
      }

      const screenshotPath = await saveUpload(appId, screenId, buffer, deviceType);
      const variant = createScreenVariant(screenId, deviceType, screenshotPath);
      const updatedScreen = getScreenById(screenId);

      return successResponse(
        {
          screen: updatedScreen,
          variant,
        },
        201
      );
    }

    const title = formData.get('title') as string;
    const subtitle = formData.get('subtitle') as string | null;

    // Validate metadata for new logical screen
    const validated = createScreenSchema.parse({
      deviceType,
      title,
      subtitle: subtitle || undefined,
    });

    // Create screen record first to get ID
    const screen = createScreen(
      appId,
      'temp', // Temporary path, will be updated
      validated.deviceType,
      undefined
    );

    // Save file with screen/device IDs
    const screenshotPath = await saveUpload(appId, screen.id, buffer, validated.deviceType);

    // Update screen with actual path (directly in DB for compatibility fields)
    const db = getDb();
    db.prepare('UPDATE screens SET screenshot_path = ? WHERE id = ?').run(
      screenshotPath,
      screen.id
    );

    createScreenVariant(screen.id, validated.deviceType, screenshotPath);

    // Create default copy in English
    upsertCopy(screen.id, 'en', validated.title, validated.subtitle || null);

    return successResponse(getScreenById(screen.id), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
