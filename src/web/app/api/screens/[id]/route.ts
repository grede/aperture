/**
 * Individual screen API routes
 * PUT /api/screens/:id - Update screen metadata
 * DELETE /api/screens/:id - Delete screen
 */

import { NextRequest } from 'next/server';
import { updateScreen, deleteScreen, getScreenById } from '@/lib/db';
import { updateScreenSchema } from '@/lib/validators';
import {
  successResponse,
  errorResponse,
  handleApiError,
  parseBody,
  getIdFromParams,
} from '@/lib/api-helpers';

/**
 * PUT /api/screens/:id
 * Update screen metadata (device type, position)
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const routeParams = await context.params;
    const id = getIdFromParams(routeParams);
    const body = await parseBody(request);
    const validated = updateScreenSchema.parse(body);

    const screen = updateScreen(id, {
      deviceType: validated.deviceType,
      position: validated.position,
    });

    if (!screen) {
      return errorResponse('Screen not found', 404);
    }

    return successResponse(screen);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/screens/:id
 * Delete screen (cascades to copies, generated screenshots)
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const routeParams = await context.params;
    const id = getIdFromParams(routeParams);

    // Check if screen exists
    const screen = getScreenById(id);
    if (!screen) {
      return errorResponse('Screen not found', 404);
    }

    // Delete from database (cascades)
    const deleted = deleteScreen(id);

    if (deleted) {
      // Note: We don't delete the file to preserve history
      // Could add file cleanup here if desired
      return successResponse({ message: 'Screen deleted successfully' });
    }

    return errorResponse('Failed to delete screen', 500);
  } catch (error) {
    return handleApiError(error);
  }
}
