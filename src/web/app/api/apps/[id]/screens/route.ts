/**
 * Screens API routes
 * POST /api/apps/:id/screens - Add a screen to an app (with file upload)
 */

import { NextRequest } from 'next/server';
import { createScreen, getAppById, upsertCopy } from '@/lib/db';
import { saveUpload } from '@/lib/storage';
import { createScreenSchema } from '@/lib/validators';
import {
  successResponse,
  errorResponse,
  handleApiError,
  getIdFromParams,
} from '@/lib/api-helpers';

/**
 * POST /api/apps/:id/screens
 * Add a screen with file upload
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
    const deviceType = formData.get('deviceType') as string;
    const title = formData.get('title') as string;
    const subtitle = formData.get('subtitle') as string | null;

    if (!file) {
      return errorResponse('Screenshot file is required', 400);
    }

    // Validate metadata
    const validated = createScreenSchema.parse({
      deviceType,
      title,
      subtitle: subtitle || undefined,
    });

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return errorResponse('File must be an image', 400);
    }

    // Create screen record first to get ID
    const screen = createScreen(
      appId,
      'temp', // Temporary path, will be updated
      validated.deviceType,
      undefined
    );

    // Save file with screen ID
    const screenshotPath = await saveUpload(appId, screen.id, buffer);

    // Update screen with actual path (directly in DB)
    const { getDb } = await import('@/lib/db');
    const db = getDb();
    db.prepare('UPDATE screens SET screenshot_path = ? WHERE id = ?').run(
      screenshotPath,
      screen.id
    );

    // Create default copy in English
    upsertCopy(screen.id, 'en', validated.title, validated.subtitle || null);

    // Return updated screen
    const updatedScreen = {
      ...screen,
      screenshot_path: screenshotPath,
    };

    return successResponse(updatedScreen, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
