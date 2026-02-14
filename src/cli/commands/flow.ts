import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import YAML from 'yaml';
import type { FlowDefinition, FlowStep } from '../../types/index.js';

interface FlowOptions {
  file?: string;
}

/**
 * Format a step for display
 */
function formatStep(step: FlowStep, index: number): string {
  const num = chalk.dim(`${index + 1}.`);

  switch (step.action) {
    case 'navigate':
      return `${num} ${chalk.blue('Navigate')}: ${chalk.dim(step.instruction)}`;
    case 'action':
      return `${num} ${chalk.cyan('Action')}: ${chalk.dim(step.instruction)}`;
    case 'screenshot':
      return `${num} ${chalk.green('Screenshot')}: ${chalk.cyan(step.label)}`;
    case 'type':
      return `${num} ${chalk.yellow('Type')}: "${chalk.dim(step.text)}"`;
    case 'wait':
      const duration = step.duration ? `${step.duration}ms` : 'until condition';
      return `${num} ${chalk.magenta('Wait')}: ${chalk.dim(duration)}`;
    default:
      return `${num} Unknown action`;
  }
}

/**
 * Display current flow
 */
function displayFlow(flow: FlowDefinition): void {
  console.log(chalk.bold('\n📱 Current Flow:\n'));
  console.log(chalk.dim(`App: ${flow.app}\n`));

  if (flow.steps.length === 0) {
    console.log(chalk.yellow('  (No steps defined yet)\n'));
  } else {
    flow.steps.forEach((step, idx) => {
      console.log(`  ${formatStep(step, idx)}`);
    });
    console.log();
  }
}

/**
 * Prompt for a new navigate step
 */
async function createNavigateStep(): Promise<FlowStep> {
  const { instruction } = await inquirer.prompt([
    {
      type: 'input',
      name: 'instruction',
      message: 'Enter navigation instruction:',
      validate: (input: string) =>
        input.trim().length > 0 || 'Instruction cannot be empty',
    },
  ]);

  return { action: 'navigate', instruction };
}

/**
 * Prompt for a new action step
 */
async function createActionStep(): Promise<FlowStep> {
  const { instruction } = await inquirer.prompt([
    {
      type: 'input',
      name: 'instruction',
      message: 'Enter action instruction:',
      validate: (input: string) =>
        input.trim().length > 0 || 'Instruction cannot be empty',
    },
  ]);

  return { action: 'action', instruction };
}

/**
 * Prompt for a new screenshot step
 */
async function createScreenshotStep(): Promise<FlowStep> {
  const { label } = await inquirer.prompt([
    {
      type: 'input',
      name: 'label',
      message: 'Enter screenshot label (filename without extension):',
      validate: (input: string) => {
        if (input.trim().length === 0) return 'Label cannot be empty';
        if (!/^[a-zA-Z0-9_-]+$/.test(input)) {
          return 'Label can only contain letters, numbers, hyphens, and underscores';
        }
        return true;
      },
    },
  ]);

  return { action: 'screenshot', label };
}

/**
 * Prompt for a new type step
 */
async function createTypeStep(): Promise<FlowStep> {
  const { text } = await inquirer.prompt([
    {
      type: 'input',
      name: 'text',
      message: 'Enter text to type:',
      validate: (input: string) =>
        input.trim().length > 0 || 'Text cannot be empty',
    },
  ]);

  return { action: 'type', text };
}

/**
 * Prompt for a new wait step
 */
async function createWaitStep(): Promise<FlowStep> {
  const { waitType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'waitType',
      message: 'Wait type:',
      choices: [
        { name: 'Fixed duration (milliseconds)', value: 'duration' },
        { name: 'Wait for condition (not yet implemented)', value: 'condition' },
      ],
    },
  ]);

  if (waitType === 'duration') {
    const { duration } = await inquirer.prompt([
      {
        type: 'number',
        name: 'duration',
        message: 'Duration (milliseconds):',
        default: 1000,
        validate: (input: number) =>
          input > 0 || 'Duration must be greater than 0',
      },
    ]);

    return { action: 'wait', duration };
  } else {
    const { condition } = await inquirer.prompt([
      {
        type: 'input',
        name: 'condition',
        message: 'Condition description:',
      },
    ]);

    return { action: 'wait', condition };
  }
}

/**
 * Prompt to add a new step
 */
async function addStep(): Promise<FlowStep> {
  const { actionType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'actionType',
      message: 'Select step type:',
      choices: [
        { name: '🧭 Navigate - AI navigates to a screen', value: 'navigate' },
        { name: '🎯 Action - AI performs an action', value: 'action' },
        { name: '📸 Screenshot - Capture current screen', value: 'screenshot' },
        { name: '⌨️  Type - Enter text', value: 'type' },
        { name: '⏱️  Wait - Pause execution', value: 'wait' },
      ],
    },
  ]);

  switch (actionType) {
    case 'navigate':
      return createNavigateStep();
    case 'action':
      return createActionStep();
    case 'screenshot':
      return createScreenshotStep();
    case 'type':
      return createTypeStep();
    case 'wait':
      return createWaitStep();
    default:
      throw new Error(`Unknown action type: ${actionType}`);
  }
}

/**
 * Edit an existing step
 */
async function editStep(currentStep: FlowStep): Promise<FlowStep> {
  console.log(chalk.dim('\nCurrent step:'), formatStep(currentStep, 0));

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: 'Edit this step', value: 'edit' },
        { name: 'Keep as is', value: 'keep' },
      ],
    },
  ]);

  if (action === 'keep') {
    return currentStep;
  }

  // Re-create the step based on its type
  switch (currentStep.action) {
    case 'navigate':
      return createNavigateStep();
    case 'action':
      return createActionStep();
    case 'screenshot':
      return createScreenshotStep();
    case 'type':
      return createTypeStep();
    case 'wait':
      return createWaitStep();
    default:
      return currentStep;
  }
}

export async function flowCommand(options: FlowOptions): Promise<void> {
  const flowPath = resolve(process.cwd(), options.file ?? 'aperture-flow.yaml');
  let flow: FlowDefinition;

  // Try to load existing flow
  try {
    const flowContent = await readFile(flowPath, 'utf-8');
    flow = YAML.parse(flowContent) as FlowDefinition;
    console.log(chalk.green(`\n✓ Loaded existing flow from ${chalk.cyan('aperture-flow.yaml')}`));
  } catch {
    // Create new flow
    const configPath = resolve(process.cwd(), 'aperture.config.yaml');
    let appPath = './build/MyApp.app';

    try {
      const configContent = await readFile(configPath, 'utf-8');
      const config = YAML.parse(configContent);
      appPath = config.app ?? appPath;
    } catch {
      // Config doesn't exist, use default
    }

    flow = {
      app: appPath,
      steps: [],
    };

    console.log(chalk.yellow('\n⚠  No existing flow found. Creating new flow.'));
  }

  console.log(chalk.bold.blue('\n🎬 Aperture Flow Editor\n'));
  console.log(chalk.dim('Build your screenshot flow step by step.\n'));

  // Main loop
  let running = true;

  while (running) {
    displayFlow(flow);

    const { mainAction } = await inquirer.prompt([
      {
        type: 'list',
        name: 'mainAction',
        message: 'What would you like to do?',
        choices: [
          { name: '➕ Add step', value: 'add' },
          ...(flow.steps.length > 0
            ? [
                { name: '✏️  Edit step', value: 'edit' },
                { name: '🗑️  Delete step', value: 'delete' },
                { name: '↕️  Reorder steps', value: 'reorder' },
                new inquirer.Separator(),
              ]
            : []),
          { name: '💾 Save and exit', value: 'save' },
          { name: '🚪 Exit without saving', value: 'exit' },
        ],
      },
    ]);

    switch (mainAction) {
      case 'add': {
        const newStep = await addStep();
        flow.steps.push(newStep);
        console.log(chalk.green('\n✓ Step added'));
        break;
      }

      case 'edit': {
        const { stepIndex } = await inquirer.prompt([
          {
            type: 'list',
            name: 'stepIndex',
            message: 'Select step to edit:',
            choices: flow.steps.map((step, idx) => ({
              name: formatStep(step, idx),
              value: idx,
            })),
          },
        ]);

        flow.steps[stepIndex] = await editStep(flow.steps[stepIndex]);
        console.log(chalk.green('\n✓ Step updated'));
        break;
      }

      case 'delete': {
        const { stepIndex } = await inquirer.prompt([
          {
            type: 'list',
            name: 'stepIndex',
            message: 'Select step to delete:',
            choices: flow.steps.map((step, idx) => ({
              name: formatStep(step, idx),
              value: idx,
            })),
          },
        ]);

        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Are you sure?',
            default: false,
          },
        ]);

        if (confirm) {
          flow.steps.splice(stepIndex, 1);
          console.log(chalk.green('\n✓ Step deleted'));
        }
        break;
      }

      case 'reorder': {
        const { stepIndex } = await inquirer.prompt([
          {
            type: 'list',
            name: 'stepIndex',
            message: 'Select step to move:',
            choices: flow.steps.map((step, idx) => ({
              name: formatStep(step, idx),
              value: idx,
            })),
          },
        ]);

        const { newPosition } = await inquirer.prompt([
          {
            type: 'number',
            name: 'newPosition',
            message: `Move to position (1-${flow.steps.length}):`,
            default: stepIndex + 1,
            validate: (input: number) => {
              if (input < 1 || input > flow.steps.length) {
                return `Position must be between 1 and ${flow.steps.length}`;
              }
              return true;
            },
          },
        ]);

        const [step] = flow.steps.splice(stepIndex, 1);
        flow.steps.splice(newPosition - 1, 0, step);
        console.log(chalk.green('\n✓ Step moved'));
        break;
      }

      case 'save': {
        await writeFile(flowPath, YAML.stringify(flow));
        console.log(chalk.green(`\n✓ Flow saved to ${chalk.cyan('aperture-flow.yaml')}`));
        console.log(chalk.dim(`\nRun ${chalk.cyan('aperture run')} to execute your flow.\n`));
        running = false;
        break;
      }

      case 'exit': {
        const { confirmExit } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmExit',
            message: 'Exit without saving changes?',
            default: false,
          },
        ]);

        if (confirmExit) {
          console.log(chalk.yellow('\nExited without saving.\n'));
          running = false;
        }
        break;
      }
    }
  }
}
