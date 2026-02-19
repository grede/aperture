/**
 * Generation bulk download API
 * GET /api/generations/:id/download - Download screenshots as ZIP
 * Optional query: ?locale=xx
 */

import { NextRequest } from 'next/server';
import { getGenerationWithScreenshots, getScreensByAppId } from '@/lib/db';
import { readGeneration } from '@/lib/storage';
import { createZipBuffer } from '@/lib/zip';
import { errorResponse, handleApiError, getIdFromParams } from '@/lib/api-helpers';

/**
 * GET /api/generations/:id/download
 * Download all generation screenshots (or locale subset) as ZIP.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const routeParams = await context.params;
    const generationId = getIdFromParams(routeParams);
    const locale = request.nextUrl.searchParams.get('locale')?.trim();

    if (locale && !/^[A-Za-z0-9-]+$/.test(locale)) {
      return errorResponse('Invalid locale query parameter', 400);
    }

    const generation = getGenerationWithScreenshots(generationId);
    if (!generation) {
      return errorResponse('Generation not found', 404);
    }

    const scopeScreenshots = locale
      ? generation.screenshots.filter((screenshot) => screenshot.locale === locale)
      : generation.screenshots;

    if (scopeScreenshots.length === 0) {
      return errorResponse('No screenshots found for download scope', 404);
    }

    const screenOrderById = new Map<number, number>();
    getScreensByAppId(generation.app_id).forEach((screen) => {
      screenOrderById.set(screen.id, screen.position + 1);
    });

    const orderedScreenshots = [...scopeScreenshots].sort((a, b) => {
      if (!locale && a.locale !== b.locale) {
        return a.locale.localeCompare(b.locale);
      }
      const orderA = screenOrderById.get(a.screen_id) ?? a.screen_id;
      const orderB = screenOrderById.get(b.screen_id) ?? b.screen_id;
      return orderA - orderB;
    });

    const entries = await Promise.all(
      orderedScreenshots.map(async (screenshot) => {
        const order = screenOrderById.get(screenshot.screen_id) ?? screenshot.screen_id;
        const fileName = `screen-${String(order).padStart(2, '0')}.png`;
        const entryName = locale ? fileName : `${screenshot.locale}/${fileName}`;
        const imageBuffer = await readGeneration(screenshot.output_path);
        return { name: entryName, data: imageBuffer };
      })
    );

    const zipBuffer = createZipBuffer(entries);
    const archiveName = locale
      ? `generation-${generationId}-${locale}.zip`
      : `generation-${generationId}-all.zip`;

    return new Response(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${archiveName}"`,
        'Content-Length': String(zipBuffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
