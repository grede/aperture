/**
 * Generation API
 * POST /api/apps/:id/generate - Start screenshot generation
 */

import { NextRequest } from 'next/server';
import { getAppById, createGeneration } from '@/lib/db';
import { getGenerationService } from '@/services/generation.service';
import { startGenerationSchema } from '@/lib/validators';
import {
  successResponse,
  errorResponse,
  handleApiError,
  parseBody,
  getIdFromParams,
} from '@/lib/api-helpers';

/**
 * POST /api/apps/:id/generate
 * Start a screenshot generation job
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const routeParams = await context.params;
    const appId = getIdFromParams(routeParams);

    // Verify app exists
    const app = getAppById(appId);
    if (!app) {
      return errorResponse('App not found', 404);
    }

    const body = await parseBody(request);
    const validated = startGenerationSchema.parse(body);

    // Create generation record
    const generation = createGeneration(appId, {
      devices: validated.devices,
      locales: validated.locales,
      template_style: validated.template_style,
      template_background: validated.template_background,
      frame_mode: validated.frame_mode,
      frame_modes: validated.frame_modes,
      frame_asset_files: validated.frame_asset_files,
    });

    // Start generation asynchronously
    const generationService = getGenerationService();
    generationService.startGeneration(generation.id);

    return successResponse(
      {
        generation_id: generation.id,
        status: 'pending',
        message: 'Generation started',
      },
      202
    );
  } catch (error) {
    return handleApiError(error);
  }
}
