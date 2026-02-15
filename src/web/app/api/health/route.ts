/**
 * Health check endpoint
 * GET /api/health - Check if API key is configured
 */

import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const hasApiKey = !!process.env.OPENAI_API_KEY;

  return Response.json({
    status: 'ok',
    openai_configured: hasApiKey,
    database_path: process.env.DATABASE_PATH || './aperture-data/aperture.db',
    uploads_dir: process.env.UPLOADS_DIR || './aperture-data/uploads',
    generations_dir: process.env.GENERATIONS_DIR || './aperture-data/generations',
  });
}
