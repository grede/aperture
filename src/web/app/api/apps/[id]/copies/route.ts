/**
 * Copies API routes
 * GET /api/apps/:id/copies - Get all copies for an app
 * PUT /api/apps/:id/copies - Batch update copies
 * DELETE /api/apps/:id/copies - Delete all copies for a locale in this app
 */

import { NextRequest } from 'next/server';
import { getCopiesByAppId, upsertCopy, getAppById, deleteCopiesByAppLocale } from '@/lib/db';
import { batchUpdateCopiesSchema, deleteLocaleCopiesSchema } from '@/lib/validators';
import {
  successResponse,
  errorResponse,
  handleApiError,
  parseBody,
  getIdFromParams,
} from '@/lib/api-helpers';

/**
 * GET /api/apps/:id/copies
 * Get all copies for an app (organized by screen and locale)
 */
export async function GET(
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

    const copies = getCopiesByAppId(appId);
    return successResponse(copies);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/apps/:id/copies
 * Batch update copies
 */
export async function PUT(
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

    const body = await parseBody(request);
    const validated = batchUpdateCopiesSchema.parse(body);

    // Process all updates
    const results = [];
    for (const update of validated.updates) {
      const copy = upsertCopy(
        update.screen_id,
        update.locale,
        update.title,
        update.subtitle || null
      );
      results.push(copy);
    }

    return successResponse({
      message: `Updated ${results.length} copies`,
      copies: results,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/apps/:id/copies
 * Delete all copies for a locale across app screens
 */
export async function DELETE(
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

    const body = await parseBody(request);
    const validated = deleteLocaleCopiesSchema.parse(body);

    const deletedCount = deleteCopiesByAppLocale(appId, validated.locale);

    return successResponse({
      message: `Deleted ${deletedCount} copy item(s) for locale ${validated.locale}`,
      locale: validated.locale,
      deleted_count: deletedCount,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
