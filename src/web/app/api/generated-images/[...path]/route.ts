/**
 * Static file serving for generated screenshots
 * GET /api/generated-images/:path - Serve generated screenshot
 */

import { NextRequest } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const routeParams = await context.params;
    const generationsDir = process.env.GENERATIONS_DIR || './aperture-data/generations';
    const filePath = join(process.cwd(), generationsDir, ...routeParams.path);

    const buffer = await readFile(filePath);

    return new Response(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    return new Response('Not found', { status: 404 });
  }
}
