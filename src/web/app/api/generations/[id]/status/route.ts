/**
 * Generation Status API
 * GET /api/generations/:id/status - Poll generation status
 */

import { NextRequest } from 'next/server';
import { getGenerationById } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  handleApiError,
  getIdFromParams,
} from '@/lib/api-helpers';

/**
 * GET /api/generations/:id/status
 * Get generation status (for polling)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = getIdFromParams(params);
    const generation = getGenerationById(id);

    if (!generation) {
      return errorResponse('Generation not found', 404);
    }

    return successResponse({
      id: generation.id,
      status: generation.status,
      progress: generation.progress,
      error: generation.error,
      completed_at: generation.completed_at,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
