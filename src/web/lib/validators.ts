/**
 * Zod validation schemas for API requests
 */

import { z } from 'zod';
import { SUPPORTED_LOCALES, TEMPLATE_FONT_OPTIONS, TEMPLATE_FONT_SIZE_LIMITS } from './constants';

/**
 * Device type schema
 */
export const deviceTypeSchema = z.enum(['iPhone', 'iPad', 'Android-phone', 'Android-tablet']);

/**
 * Template style schema
 */
export const templateStyleSchema = z.enum(['minimal', 'modern', 'gradient', 'dark', 'playful']);
export const hexColorSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Color must be a valid hex value');
const templateFontFamilyValues = TEMPLATE_FONT_OPTIONS.map((font) => font.value);
const templateFontFamilySchema = z.enum(
  templateFontFamilyValues as [
    (typeof templateFontFamilyValues)[number],
    ...(typeof templateFontFamilyValues)[number][],
  ]
);
export const templateTextStyleSchema = z
  .object({
    font_family: templateFontFamilySchema.optional(),
    font_size: z
      .number()
      .int()
      .min(TEMPLATE_FONT_SIZE_LIMITS.min)
      .max(TEMPLATE_FONT_SIZE_LIMITS.max)
      .optional(),
    font_color: hexColorSchema.optional(),
  })
  .strict();
export const templateBackgroundSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('solid'),
    color: hexColorSchema,
  }),
  z.object({
    mode: z.literal('gradient'),
    from: hexColorSchema,
    to: hexColorSchema,
    angle: z.number().min(0).max(360).optional(),
  }),
]);

/**
 * Frame mode schema
 */
export const frameModeSchema = z.enum(['none', 'minimal', 'realistic']);
export const frameModesByDeviceSchema = z
  .object({
    iPhone: frameModeSchema.optional(),
    iPad: frameModeSchema.optional(),
    'Android-phone': frameModeSchema.optional(),
    'Android-tablet': frameModeSchema.optional(),
  })
  .strict();
export const frameAssetFilesByDeviceSchema = z
  .object({
    iPhone: z.string().min(1).optional(),
    iPad: z.string().min(1).optional(),
    'Android-phone': z.string().min(1).optional(),
    'Android-tablet': z.string().min(1).optional(),
  })
  .strict();

/**
 * Locale code schema (validates against supported locales)
 */
export const localeSchema = z
  .string()
  .refine((locale) => SUPPORTED_LOCALES.some((l) => l.code === locale), {
    message: 'Invalid locale code',
  });

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
  title: z.string().min(1, 'Title is required'),
  subtitle: z.string().optional(),
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
  title: z.string().min(1),
  subtitle: z.string().optional().nullable(),
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
  template_background: templateBackgroundSchema.optional(),
  text_style: templateTextStyleSchema.optional(),
  frame_mode: frameModeSchema,
  frame_modes: frameModesByDeviceSchema.optional(),
  frame_asset_files: frameAssetFilesByDeviceSchema.optional(),
});

/**
 * Template preview request schema
 */
export const templatePreviewSchema = z.object({
  screenshot_base64: z.string().min(1, 'Screenshot is required'),
  style: templateStyleSchema,
  template_background: templateBackgroundSchema.optional(),
  text_style: templateTextStyleSchema.optional(),
  device_type: deviceTypeSchema,
  title: z.string().min(1),
  subtitle: z.string().optional(),
  frame_mode: frameModeSchema.optional().default('minimal'),
  frame_asset_file: z.string().min(1).optional(),
});

/**
 * Gradient suggestion request schema
 */
export const suggestGradientSchema = z.object({
  screenshot_base64: z.string().min(1, 'Screenshot is required'),
  app_name: z.string().min(1).max(100).optional(),
  app_description: z.string().min(1).max(500).optional(),
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
