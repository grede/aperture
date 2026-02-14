import { readFile } from 'fs/promises';
import YAML from 'yaml';
import { z } from 'zod';
import type { FlowDefinition, FlowStep, ValidationResult, LocaleData } from '../types/index.js';

// ── Zod Schemas ────────────────────────────────────────────────

const FlowStepSchema = z.union([
  z.object({
    action: z.literal('navigate'),
    instruction: z.string().min(1, 'Instruction cannot be empty'),
  }),
  z.object({
    action: z.literal('action'),
    instruction: z.string().min(1, 'Instruction cannot be empty'),
  }),
  z.object({
    action: z.literal('screenshot'),
    label: z.string().min(1, 'Label cannot be empty'),
  }),
  z.object({
    action: z.literal('type'),
    text: z.string(),
  }),
  z.object({
    action: z.literal('wait'),
    duration: z.number().positive().optional(),
    condition: z.string().optional(),
  }).refine(
    (data) => data.duration !== undefined || data.condition !== undefined,
    'Wait step must have either duration or condition'
  ),
]);

const FlowDefinitionSchema = z.object({
  app: z.string().min(1, 'App path cannot be empty'),
  steps: z.array(FlowStepSchema).min(1, 'Flow must have at least one step'),
});

// ── FlowParser Class ───────────────────────────────────────────

export class FlowParser {
  /**
   * Parse a YAML flow file into a FlowDefinition
   */
  async parse(yamlPath: string): Promise<FlowDefinition> {
    try {
      const content = await readFile(yamlPath, 'utf-8');
      const parsed = YAML.parse(content);

      // Validate with Zod
      const validated = FlowDefinitionSchema.parse(parsed);

      return validated as FlowDefinition;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(
          `Flow validation failed:\n${error.errors.map((e) => `  - ${e.path.join('.')}: ${e.message}`).join('\n')}`
        );
      }
      throw error;
    }
  }

  /**
   * Validate a flow definition without parsing from file
   */
  validate(flow: FlowDefinition): ValidationResult {
    try {
      FlowDefinitionSchema.parse(flow);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map((e) => ({
            line: 0, // Line numbers would require custom YAML parsing
            message: `${e.path.join('.')}: ${e.message}`,
          })),
        };
      }
      return {
        valid: false,
        errors: [{ line: 0, message: String(error) }],
      };
    }
  }

  /**
   * Resolve {{variable}} placeholders in flow steps
   */
  resolveVariables(flow: FlowDefinition, variables: LocaleData): FlowDefinition {
    const resolvedSteps = flow.steps.map((step): FlowStep => {
      switch (step.action) {
        case 'navigate':
          return {
            ...step,
            instruction: this.replaceVariables(step.instruction, variables),
          };
        case 'action':
          return {
            ...step,
            instruction: this.replaceVariables(step.instruction, variables),
          };
        case 'type':
          return {
            ...step,
            text: this.replaceVariables(step.text, variables),
          };
        default:
          return step;
      }
    });

    return {
      ...flow,
      steps: resolvedSteps,
    };
  }

  /**
   * Replace {{variable}} placeholders with values from locale data
   */
  private replaceVariables(text: string, variables: LocaleData): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      if (varName in variables) {
        return variables[varName];
      }
      throw new Error(`Undefined variable: ${varName}`);
    });
  }

  /**
   * Extract all {{variable}} names from a flow
   */
  extractVariables(flow: FlowDefinition): Set<string> {
    const variables = new Set<string>();

    flow.steps.forEach((step) => {
      let text = '';

      switch (step.action) {
        case 'navigate':
          text = step.instruction;
          break;
        case 'action':
          text = step.instruction;
          break;
        case 'type':
          text = step.text;
          break;
      }

      const matches = text.matchAll(/\{\{(\w+)\}\}/g);
      for (const match of matches) {
        variables.add(match[1]);
      }
    });

    return variables;
  }
}
