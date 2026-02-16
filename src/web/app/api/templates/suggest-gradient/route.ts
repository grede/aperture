/**
 * Template Gradient Suggestion API
 * POST /api/templates/suggest-gradient - Suggest gradient colors from screenshot palette
 */

import { NextRequest } from 'next/server';
import { suggestGradientSchema } from '@/lib/validators';
import { getGradientSuggestionService } from '@/services/gradient-suggestion.service';
import { successResponse, handleApiError, parseBody } from '@/lib/api-helpers';

/**
 * POST /api/templates/suggest-gradient
 * Suggest two gradient colors based on uploaded screenshot color scheme
 */
export async function POST(request: NextRequest) {
  try {
    const body = await parseBody(request);
    const validated = suggestGradientSchema.parse(body);

    const suggestionService = getGradientSuggestionService();
    const suggestion = await suggestionService.suggestGradientColors({
      screenshotBase64: validated.screenshot_base64,
      appName: validated.app_name,
      appDescription: validated.app_description,
    });

    return successResponse(suggestion);
  } catch (error) {
    return handleApiError(error);
  }
}
