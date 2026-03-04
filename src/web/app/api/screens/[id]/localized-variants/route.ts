/**
 * Localized screen variants API routes
 * POST /api/screens/:id/localized-variants - Create or replace locale-specific screenshot variant
 */

import { NextRequest } from 'next/server';
import { getScreenById, upsertScreenLocalizedVariant } from '@/lib/db';
import { saveLocalizedUpload } from '@/lib/storage';
import { deviceTypeSchema, localeSchema } from '@/lib/validators';
import { successResponse, errorResponse, handleApiError, getIdFromParams } from '@/lib/api-helpers';

/**
 * POST /api/screens/:id/localized-variants
 * Create or replace a localized screenshot variant for locale + device
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const routeParams = await context.params;
    const screenId = getIdFromParams(routeParams);

    const screen = getScreenById(screenId);
    if (!screen) {
      return errorResponse('Screen not found', 404);
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const rawLocale = formData.get('locale');
    const rawDeviceType = formData.get('deviceType');

    if (!file) {
      return errorResponse('Screenshot file is required', 400);
    }
    if (!file.type.startsWith('image/')) {
      return errorResponse('File must be an image', 400);
    }
    if (typeof rawLocale !== 'string' || rawLocale.trim().length === 0) {
      return errorResponse('Locale is required', 400);
    }
    if (typeof rawDeviceType !== 'string' || rawDeviceType.trim().length === 0) {
      return errorResponse('Device type is required', 400);
    }

    const locale = localeSchema.parse(rawLocale);
    const deviceType = deviceTypeSchema.parse(rawDeviceType);

    const hasBaseVariantForDevice = screen.variants.some(
      (variant) => variant.device_type === deviceType
    );
    if (!hasBaseVariantForDevice) {
      return errorResponse(
        'Add a base screenshot for this device type before creating localized variants',
        400
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const screenshotPath = await saveLocalizedUpload(
      screen.app_id,
      screen.id,
      locale,
      deviceType,
      buffer
    );

    const localizedVariant = upsertScreenLocalizedVariant(
      screen.id,
      locale,
      deviceType,
      screenshotPath
    );

    return successResponse(
      {
        screen: getScreenById(screen.id),
        localized_variant: localizedVariant,
      },
      200
    );
  } catch (error) {
    return handleApiError(error);
  }
}
