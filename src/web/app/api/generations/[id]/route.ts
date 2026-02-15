/**
 * Generation Details API
 * GET /api/generations/:id - Get generation details with screenshots
 */

import { NextRequest } from 'next/server';
import { getGenerationWithScreenshots } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  handleApiError,
  getIdFromParams,
} from '@/lib/api-helpers';

/**
 * GET /api/generations/:id
 * Get generation details with all generated screenshots
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const routeParams = await context.params;
    const id = getIdFromParams(routeParams);
    const generation = getGenerationWithScreenshots(id);

    if (!generation) {
      return errorResponse('Generation not found', 404);
    }

    return successResponse(generation);
  } catch (error) {
    return handleApiError(error);
  }
}
