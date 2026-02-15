/**
 * Copies API routes
 * GET /api/apps/:id/copies - Get all copies for an app
 * PUT /api/apps/:id/copies - Batch update copies
 */

import { NextRequest } from 'next/server';
import { getCopiesByAppId, upsertCopy, getAppById } from '@/lib/db';
import { batchUpdateCopiesSchema } from '@/lib/validators';
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
  { params }: { params: { id: string } }
) {
  try {
    const appId = getIdFromParams(params);

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
  { params }: { params: { id: string } }
) {
  try {
    const appId = getIdFromParams(params);

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
