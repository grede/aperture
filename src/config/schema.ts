import { z } from 'zod';

/**
 * Zod schema for Aperture configuration validation
 */
export const apertureConfigSchema = z.object({
  app: z.object({
    path: z.string().min(1, 'App path is required'),
    bundleId: z.string().optional(),
    name: z.string().optional(),
  }),
  locales: z
    .array(z.string())
    .min(1, 'At least one locale is required')
    .default(['en']),
  simulators: z.object({
    iphone: z.string().optional(),
    ipad: z.string().optional(),
  }),
  templateStyle: z
    .enum(['minimal', 'modern', 'gradient', 'dark', 'playful'])
    .default('modern'),
  outputDir: z.string().default('./output'),
  guardrails: z.object({
    maxSteps: z.number().int().positive().default(50),
    stepTimeout: z.number().positive().default(10),
    runTimeout: z.number().positive().default(300),
    stepRetries: z.number().int().nonnegative().default(2),
    forbiddenActions: z.array(z.string()).optional(),
  }),
  openai: z
    .object({
      apiKey: z.string().optional(),
      model: z.enum(['gpt-4o-mini', 'gpt-4o']).default('gpt-4o-mini'),
      fallbackModel: z.enum(['gpt-4o-mini', 'gpt-4o']).optional(),
      maxTokens: z.number().int().positive().default(1000),
    })
    .optional(),
});

/**
 * Inferred TypeScript type from schema
 */
export type ApertureConfigSchema = z.infer<typeof apertureConfigSchema>;

/**
 * Validate configuration object
 */
export function validateConfig(config: unknown): ApertureConfigSchema {
  return apertureConfigSchema.parse(config);
}

/**
 * Validate configuration with detailed error messages
 */
export function validateConfigSafe(
  config: unknown
): { success: true; data: ApertureConfigSchema } | { success: false; errors: string[] } {
  const result = apertureConfigSchema.safeParse(config);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.errors.map((err) => {
    const path = err.path.join('.');
    return `${path}: ${err.message}`;
  });

  return { success: false, errors };
}
