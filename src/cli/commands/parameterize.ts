import inquirer from 'inquirer';
import { Recorder } from '../../core/recorder.js';
import { parameterizer } from '../../core/parameterizer.js';
import { aiClient } from '../../utils/ai-client.js';
import { loadConfig } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import type { Parameter } from '../../types/template.js';
import { success, error, warning, header, info, createSpinner } from '../ui.js';

/**
 * Parameterize command options
 */
export interface ParameterizeOptions {
  force?: boolean;
}

/**
 * Parameterize a recording (US-009)
 */
export async function parameterizeCommand(recordingName: string, _options: ParameterizeOptions = {}) {
  try {
    header('AI Parameterization');

    // Load config
    const config = await loadConfig();

    // Initialize AI client
    if (config.openai?.apiKey) {
      aiClient.initialize({
        apiKey: config.openai.apiKey,
        model: config.openai.model,
        fallbackModel: config.openai.fallbackModel,
        maxTokens: config.openai.maxTokens,
      });
    } else {
      error('OpenAI API key not configured');
      console.log();
      console.log('Add your API key to aperture.config.json:');
      console.log('{');
      console.log('  "openai": {');
      console.log('    "apiKey": "sk-..."');
      console.log('  }');
      console.log('}');
      console.log();
      console.log('Or set OPENAI_API_KEY environment variable.');
      process.exit(1);
    }

    // Load recording
    info(`Loading recording: ${recordingName}`);
    const recorder = new Recorder();
    const recording = await recorder.loadRecording(recordingName);

    console.log();
    info(`Recording: ${recording.name}`);
    info(`Steps: ${recording.steps.length}`);
    info(`App: ${recording.bundleId}`);
    console.log();

    // Analyze recording
    const spinner = createSpinner('Analyzing recording with AI...').start();
    const result = await parameterizer.analyze(recording);
    spinner.succeed(`Analysis complete (${result.tokensUsed} tokens used)`);

    if (result.suggestions.length === 0) {
      warning('No parameters suggested');
      console.log();
      console.log('The AI did not find any text inputs that should be parameterized.');
      console.log('This recording may not contain locale-specific test data.');
      process.exit(0);
    }

    console.log();
    success(`Found ${result.suggestions.length} suggested parameter(s)`);
    console.log();

    // Interactive review of suggestions
    const confirmedParameters: Parameter[] = [];

    for (const suggestion of result.suggestions) {
      console.log(`\nStep ${suggestion.stepIndex}: "${suggestion.originalValue}"`);
      console.log(`Suggested parameter: {{${suggestion.suggestedName}}}`);
      console.log(`Category: ${suggestion.category}`);
      console.log(`Reasoning: ${suggestion.reasoning}`);
      console.log(`Confidence: ${(suggestion.confidence * 100).toFixed(0)}%`);

      const { action } = await inquirer.prompt<{ action: 'accept' | 'edit' | 'skip' }>([
        {
          type: 'list',
          name: 'action',
          message: 'Action:',
          choices: [
            { name: 'Accept this parameter', value: 'accept' },
            { name: 'Edit parameter name', value: 'edit' },
            { name: 'Skip (keep original value)', value: 'skip' },
          ],
          default: 'accept',
        },
      ]);

      if (action === 'skip') {
        info('Skipped');
        continue;
      }

      let parameterName = suggestion.suggestedName;
      if (action === 'edit') {
        const { name } = await inquirer.prompt<{ name: string }>([
          {
            type: 'input',
            name: 'name',
            message: 'Parameter name:',
            default: suggestion.suggestedName,
            validate: (input) => {
              if (!input || input.length === 0) return 'Name is required';
              if (!/^[a-z][a-z0-9_]*$/.test(input)) {
                return 'Name must start with a letter and contain only lowercase letters, numbers, and underscores';
              }
              return true;
            },
          },
        ]);
        parameterName = name;
      }

      confirmedParameters.push({
        name: parameterName,
        originalValue: suggestion.originalValue,
        stepIndex: suggestion.stepIndex,
        description: suggestion.reasoning,
        category: suggestion.category,
      });

      success(`Added parameter: {{${parameterName}}}`);
    }

    if (confirmedParameters.length === 0) {
      warning('No parameters confirmed');
      console.log();
      console.log('Template not created. Run again to review suggestions.');
      process.exit(0);
    }

    // Create template
    console.log();
    const templateSpinner = createSpinner('Creating template...').start();
    const template = await parameterizer.createTemplate(recording, confirmedParameters);
    templateSpinner.succeed('Template created');

    console.log();
    success('Parameterization complete! 🎉');
    console.log();
    console.log('Summary:');
    console.log(`  Template: ${template.name}`);
    console.log(`  Parameters: ${template.parameters.length}`);
    console.log();
    console.log('Parameters:');
    template.parameters.forEach((p) => {
      console.log(`  - {{${p.name}}} (${p.category})`);
    });
    console.log();
    console.log('Next steps:');
    console.log(`  aperture locales generate`);
    console.log();
  } catch (err) {
    logger.error({ error: err }, 'Parameterize command failed');
    error(`Failed to parameterize: ${(err as Error).message}`);
    process.exit(1);
  }
}
