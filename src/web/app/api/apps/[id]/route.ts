/**
 * Individual app API routes
 * GET /api/apps/:id - Get app details with screens
 * PUT /api/apps/:id - Update app
 * DELETE /api/apps/:id - Delete app
 */

import { NextRequest } from 'next/server';
import {
  getAppWithScreens,
  updateApp,
  deleteApp,
  getAppById,
} from '@/lib/db';
import { updateAppSchema } from '@/lib/validators';
import {
  successResponse,
  errorResponse,
  handleApiError,
  parseBody,
  getIdFromParams,
} from '@/lib/api-helpers';
import { deleteAppUploads } from '@/lib/storage';

/**
 * GET /api/apps/:id
 * Get app with screens
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const routeParams = await context.params;
    const id = getIdFromParams(routeParams);
    const app = getAppWithScreens(id);

    if (!app) {
      return errorResponse('App not found', 404);
    }

    return successResponse(app);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/apps/:id
 * Update app
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const routeParams = await context.params;
    const id = getIdFromParams(routeParams);
    const body = await parseBody(request);
    const validated = updateAppSchema.parse(body);

    const app = updateApp(id, validated);

    if (!app) {
      return errorResponse('App not found', 404);
    }

    return successResponse(app);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/apps/:id
 * Delete app (cascades to screens, copies, generations)
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const routeParams = await context.params;
    const id = getIdFromParams(routeParams);

    // Check if app exists
    const app = getAppById(id);
    if (!app) {
      return errorResponse('App not found', 404);
    }

    // Delete from database (cascades)
    const deleted = deleteApp(id);

    if (deleted) {
      // Clean up file uploads
      await deleteAppUploads(id);
      return successResponse({ message: 'App deleted successfully' });
    }

    return errorResponse('Failed to delete app', 500);
  } catch (error) {
    return handleApiError(error);
  }
}
