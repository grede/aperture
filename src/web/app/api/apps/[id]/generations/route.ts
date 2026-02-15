/**
 * App Generations API route
 * GET /api/apps/:id/generations - List generations for an app
 */

import { NextRequest } from 'next/server';
import { getAppById, getGenerationsByAppId } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  handleApiError,
  getIdFromParams,
} from '@/lib/api-helpers';

export async function GET(
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

    const generations = getGenerationsByAppId(appId);
    return successResponse(generations);
  } catch (error) {
    return handleApiError(error);
  }
}
