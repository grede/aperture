/**
 * AI Copy Generation API
 * POST /api/copies/generate - Generate localized copies using AI
 */

import { NextRequest } from 'next/server';
import {
  getAppById,
  getScreensByAppId,
  getCopy,
  upsertCopy,
} from '@/lib/db';
import { getTranslationService } from '@/services/translation.service';
import { generateCopiesSchema } from '@/lib/validators';
import {
  successResponse,
  errorResponse,
  handleApiError,
  parseBody,
} from '@/lib/api-helpers';

/**
 * POST /api/copies/generate
 * Generate AI-translated copies for multiple locales
 */
export async function POST(request: NextRequest) {
  try {
    const body = await parseBody(request);
    const validated = generateCopiesSchema.parse(body);

    const { app_id, app_description, source_locale, target_locales } = validated;

    // Verify app exists
    const app = getAppById(app_id);
    if (!app) {
      return errorResponse('App not found', 404);
    }

    // Get all screens for this app
    const screens = getScreensByAppId(app_id);
    if (screens.length === 0) {
      return errorResponse('No screens found for this app', 400);
    }

    // Collect source copies
    const sourceCopies = [];
    for (const screen of screens) {
      const copy = getCopy(screen.id, source_locale);
      if (copy) {
        sourceCopies.push({
          screenId: screen.id,
          label: `screen_${screen.id}`,
          title: copy.title,
          subtitle: copy.subtitle || undefined,
        });
      }
    }

    if (sourceCopies.length === 0) {
      return errorResponse(
        `No copies found for source locale: ${source_locale}`,
        400
      );
    }

    // Initialize translation service
    const translationService = getTranslationService();

    // Generate translations for each target locale
    const results: Record<string, any[]> = {};

    for (const targetLocale of target_locales) {
      const translated = await translationService.translateCopies(
        sourceCopies,
        targetLocale,
        app_description
      );

      // Save to database
      const savedCopies = [];
      for (let i = 0; i < sourceCopies.length; i++) {
        const source = sourceCopies[i];
        const translation = translated[i];

        const copy = upsertCopy(
          source.screenId,
          targetLocale,
          translation.title,
          translation.subtitle || null
        );

        savedCopies.push(copy);
      }

      results[targetLocale] = savedCopies;
    }

    return successResponse({
      message: `Generated copies for ${target_locales.length} locale(s)`,
      locales: target_locales,
      results,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
