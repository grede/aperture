/**
 * Generation preset templates API
 * GET /api/generation-presets - List all saved generation presets
 * POST /api/generation-presets - Save (or update) a generation preset by name
 */

import { NextRequest } from 'next/server';
import { createOrUpdateGenerationPreset, getAllGenerationPresets } from '@/lib/db';
import { saveGenerationPresetSchema } from '@/lib/validators';
import {
  successResponse,
  handleApiError,
  parseBody,
} from '@/lib/api-helpers';

/**
 * GET /api/generation-presets
 * List all saved generation presets (shared across all apps)
 */
export async function GET() {
  try {
    const presets = getAllGenerationPresets();
    return successResponse(presets);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/generation-presets
 * Save a generation preset template
 */
export async function POST(request: NextRequest) {
  try {
    const body = await parseBody(request);
    const validated = saveGenerationPresetSchema.parse(body);

    const preset = createOrUpdateGenerationPreset(validated.name, validated.config);
    return successResponse(preset, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
