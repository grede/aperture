/**
 * Template Preview API
 * POST /api/templates/preview - Generate preview image for template selection
 */

import { NextRequest } from 'next/server';
import { getTemplateService } from '@/services/template.service';
import { DEVICE_TYPE_TO_TEMPLATE } from '@/lib/constants';
import { templatePreviewSchema } from '@/lib/validators';
import {
  successResponse,
  errorResponse,
  handleApiError,
  parseBody,
} from '@/lib/api-helpers';

/**
 * POST /api/templates/preview
 * Generate a preview image for template selection
 */
export async function POST(request: NextRequest) {
  try {
    const body = await parseBody(request);
    const validated = templatePreviewSchema.parse(body);

    // Decode base64 screenshot
    const screenshotBuffer = Buffer.from(
      validated.screenshot_base64,
      'base64'
    );

    // Map device type
    const templateDeviceType = DEVICE_TYPE_TO_TEMPLATE[validated.device_type];

    // Generate preview
    const templateService = getTemplateService();
    const previewBuffer = await templateService.generatePreview(
      screenshotBuffer,
      validated.style,
      templateDeviceType,
      validated.title,
      validated.subtitle || '',
      validated.frame_mode
    );

    // Return as base64
    const previewBase64 = previewBuffer.toString('base64');

    return successResponse({
      image_base64: previewBase64,
      style: validated.style,
      frame_mode: validated.frame_mode,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
