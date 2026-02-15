/**
 * Apps API routes
 * GET /api/apps - List all apps
 * POST /api/apps - Create a new app
 */

import { NextRequest } from 'next/server';
import { getAllApps, createApp } from '@/lib/db';
import { createAppSchema } from '@/lib/validators';
import {
  successResponse,
  errorResponse,
  handleApiError,
  parseBody,
} from '@/lib/api-helpers';

/**
 * GET /api/apps
 * List all apps
 */
export async function GET() {
  try {
    const apps = getAllApps();
    return successResponse(apps);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/apps
 * Create a new app
 */
export async function POST(request: NextRequest) {
  try {
    const body = await parseBody(request);
    const validated = createAppSchema.parse(body);

    const app = createApp(validated.name, validated.description);

    return successResponse(app, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
