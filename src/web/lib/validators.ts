/**
 * Zod validation schemas for API requests
 */

import { z } from 'zod';
import { DEVICE_TYPES, TEMPLATE_STYLES, FRAME_MODES, SUPPORTED_LOCALES } from './constants';

/**
 * Device type schema
 */
export const deviceTypeSchema = z.enum(['iPhone', 'iPad', 'Android-phone', 'Android-tablet']);

/**
 * Template style schema
 */
export const templateStyleSchema = z.enum(['minimal', 'modern', 'gradient', 'dark', 'playful']);

/**
 * Frame mode schema
 */
export const frameModeSchema = z.enum(['none', 'minimal', 'realistic']);

/**
 * Locale code schema (validates against supported locales)
 */
export const localeSchema = z.string().refine(
  (locale) => SUPPORTED_LOCALES.some((l) => l.code === locale),
  { message: 'Invalid locale code' }
);

/**
 * Create app request schema
 */
export const createAppSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(500, 'Description must be less than 500 characters'),
});

/**
 * Update app request schema
 */
export const updateAppSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().min(1).max(500).optional(),
  })
  .refine((data) => data.name !== undefined || data.description !== undefined, {
    message: 'At least one field must be provided',
  });

/**
 * Create screen request schema (for metadata, file handled separately)
 */
export const createScreenSchema = z.object({
  deviceType: deviceTypeSchema,
  title: z.string().min(1, 'Title is required').max(30, 'Title must be less than 30 characters'),
  subtitle: z.string().max(80, 'Subtitle must be less than 80 characters').optional(),
});

/**
 * Update screen request schema
 */
export const updateScreenSchema = z.object({
  deviceType: deviceTypeSchema.optional(),
  position: z.number().int().min(0).optional(),
});

/**
 * Copy update schema
 */
export const copyUpdateSchema = z.object({
  screen_id: z.number().int().positive(),
  locale: localeSchema,
  title: z.string().min(1).max(30),
  subtitle: z.string().max(80).optional().nullable(),
});

/**
 * Batch update copies request schema
 */
export const batchUpdateCopiesSchema = z.object({
  updates: z.array(copyUpdateSchema).min(1, 'At least one update is required'),
});

/**
 * Generate AI copies request schema
 */
export const generateCopiesSchema = z.object({
  app_id: z.number().int().positive(),
  app_description: z.string().min(1),
  source_locale: localeSchema,
  target_locales: z
    .array(localeSchema)
    .min(1, 'At least one target locale is required')
    .refine((locales) => new Set(locales).size === locales.length, {
      message: 'Target locales must be unique',
    }),
});

/**
 * Start generation request schema
 */
export const startGenerationSchema = z.object({
  devices: z
    .array(deviceTypeSchema)
    .min(1, 'At least one device is required')
    .refine((devices) => new Set(devices).size === devices.length, {
      message: 'Devices must be unique',
    }),
  locales: z
    .array(localeSchema)
    .min(1, 'At least one locale is required')
    .refine((locales) => new Set(locales).size === locales.length, {
      message: 'Locales must be unique',
    }),
  template_style: templateStyleSchema,
  frame_mode: frameModeSchema,
});

/**
 * Template preview request schema
 */
export const templatePreviewSchema = z.object({
  screenshot_base64: z.string().min(1, 'Screenshot is required'),
  style: templateStyleSchema,
  device_type: deviceTypeSchema,
  title: z.string().min(1).max(30),
  subtitle: z.string().max(80).optional(),
  frame_mode: frameModeSchema.optional().default('minimal'),
});

/**
 * Pagination schema
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/**
 * ID parameter schema
 */
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/**
 * Helper to validate request body
 */
export function validateBody<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Helper to validate query params
 */
export function validateQuery<T>(schema: z.ZodSchema<T>, params: unknown): T {
  return schema.parse(params);
}

/**
 * Helper to validate path params
 */
export function validateParams<T>(schema: z.ZodSchema<T>, params: unknown): T {
  return schema.parse(params);
}
