/**
 * Static file serving for uploads
 * GET /api/uploads/:path - Serve uploaded screenshot
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
    const uploadsDir = process.env.UPLOADS_DIR || './aperture-data/uploads';
    const filePath = join(process.cwd(), uploadsDir, ...routeParams.path);

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
