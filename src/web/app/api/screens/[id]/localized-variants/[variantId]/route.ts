/**
 * Localized screen variant API routes
 * DELETE /api/screens/:id/localized-variants/:variantId - Delete locale-specific screenshot variant
 */

import { NextRequest } from 'next/server';
import {
  deleteScreenLocalizedVariant,
  getScreenById,
  getScreenLocalizedVariantById,
} from '@/lib/db';
import { successResponse, errorResponse, handleApiError, getIdFromParams } from '@/lib/api-helpers';

/**
 * DELETE /api/screens/:id/localized-variants/:variantId
 * Delete a localized screenshot variant
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; variantId: string }> }
) {
  try {
    const routeParams = await context.params;
    const screenId = getIdFromParams({ id: routeParams.id });
    const variantId = getIdFromParams({ id: routeParams.variantId });

    const screen = getScreenById(screenId);
    if (!screen) {
      return errorResponse('Screen not found', 404);
    }

    const variant = getScreenLocalizedVariantById(variantId);
    if (!variant || variant.screen_id !== screenId) {
      return errorResponse('Localized variant not found', 404);
    }

    const deleted = deleteScreenLocalizedVariant(variantId);
    if (!deleted) {
      return errorResponse('Failed to delete localized variant', 500);
    }

    return successResponse({ message: 'Localized variant deleted successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
