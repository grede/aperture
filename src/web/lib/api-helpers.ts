/**
 * API helper functions for consistent responses and error handling
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/**
 * Success response
 */
export function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  );
}

/**
 * Error response
 */
export function errorResponse(message: string, status: number = 400) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status }
  );
}

/**
 * Validation error response
 */
export function validationErrorResponse(errors: Record<string, string[]>) {
  return NextResponse.json(
    {
      success: false,
      error: 'Validation failed',
      errors,
    },
    { status: 422 }
  );
}

/**
 * Handle API errors
 */
export function handleApiError(error: unknown) {
  console.error('API Error:', error);

  if (error instanceof ZodError) {
    const errors: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const path = issue.path.join('.');
      if (!errors[path]) {
        errors[path] = [];
      }
      errors[path].push(issue.message);
    }
    return validationErrorResponse(errors);
  }

  if (error instanceof Error) {
    return errorResponse(error.message, 500);
  }

  return errorResponse('Internal server error', 500);
}

/**
 * Parse JSON body
 */
export async function parseBody<T = unknown>(request: Request): Promise<T> {
  try {
    return await request.json();
  } catch {
    throw new Error('Invalid JSON body');
  }
}

/**
 * Get ID from params
 */
export function getIdFromParams(params: { id: string }): number {
  const id = parseInt(params.id, 10);
  if (isNaN(id) || id <= 0) {
    throw new Error('Invalid ID parameter');
  }
  return id;
}
