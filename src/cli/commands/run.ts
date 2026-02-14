import { readFile, writeFile, mkdir } from 'fs/promises';
import { resolve, join } from 'path';
import { spawn } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import YAML from 'yaml';
import { FlowParser } from '../../core/flow-parser.js';
import { DeviceManager } from '../../core/device-manager.js';
import { MCPClient } from '../../core/mcp-client.js';
import { AINavigator } from '../../core/ai-navigator.js';
import { CostTracker } from '../../core/cost-tracker.js';
import { LocaleManager } from '../../core/locale-manager.js';
import type { ApertureConfig, FlowDefinition, LocaleData } from '../../types/index.js';

interface RunOptions {
  flow?: string;
  locale?: string;
  device?: 'iphone' | 'ipad' | 'both';
  dryRun?: boolean;
  verbose?: boolean;
}

/**
 * Check if a command exists in PATH
 */
async function commandExists(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const which = process.platform === 'win32' ? 'where' : 'which';
    const proc = spawn(which, [command], { stdio: 'ignore' });

    proc.on('close', (code) => {
      resolve(code === 0);
    });

    proc.on('error', () => {
      resolve(false);
    });
  });
}

export async function runCommand(options: RunOptions): Promise<void> {
  const startTime = Date.now();

  // Check for mobile-mcp before proceeding
  const hasMobileMcp = await commandExists('mobile-mcp');

  if (!hasMobileMcp) {
    console.error(chalk.red('\n✗ mobile-mcp not found in PATH\n'));
    console.log(chalk.yellow('mobile-mcp is required to control iOS Simulators.\n'));
    console.log(chalk.dim('Run the following command to check and install dependencies:\n'));
    console.log(chalk.cyan('  aperture doctor\n'));
    process.exit(1);
  }

  // Load config
  const configPath = resolve(process.cwd(), 'aperture.config.yaml');
  let config: ApertureConfig;

  try {
    const configContent = await readFile(configPath, 'utf-8');
    config = YAML.parse(configContent) as ApertureConfig;

    // Resolve environment variables
    if (config.llm.apiKey.startsWith('${')) {
      const envVar = config.llm.apiKey.slice(2, -1);
      config.llm.apiKey = process.env[envVar] ?? '';

      if (!config.llm.apiKey) {
        console.log(chalk.yellow(`\n⚠  Environment variable ${envVar} not found.\n`));

        const { apiKey } = await inquirer.prompt([
          {
            type: 'password',
            name: 'apiKey',
            message: 'Enter your OpenAI API key:',
            mask: '*',
            validate: (input: string) => {
              if (!input || input.trim().length === 0) {
                return 'API key is required';
              }
              if (!input.startsWith('sk-')) {
                return 'OpenAI API keys typically start with "sk-"';
              }
              return true;
            },
          },
        ]);

        config.llm.apiKey = apiKey;

        console.log(chalk.dim(`\nℹ  To avoid this prompt in the future, set:`));
        console.log(chalk.cyan(`   export ${envVar}="${apiKey}"\n`));
      }
    }
  } catch (error) {
    console.error(
      chalk.red('Error loading config:'),
      error instanceof Error ? error.message : error
    );
    console.log(chalk.dim(`\nRun ${chalk.cyan('aperture init')} to create a configuration.\n`));
    process.exit(1);
  }

  // Load flow
  const flowPath = options.flow ?? config.flow;
  const flowParser = new FlowParser();
  let flow: FlowDefinition;

  try {
    flow = await flowParser.parse(resolve(process.cwd(), flowPath));
    console.log(chalk.green(`✓ Loaded flow with ${flow.steps.length} step(s)\n`));
  } catch (error) {
    console.error(chalk.red('Error parsing flow:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }

  // Determine locales and devices to run
  const locales = options.locale ? [options.locale] : config.locales;

  // Determine which devices to use based on config and options
  let devices: ('iphone' | 'ipad')[];

  if (options.device === 'iphone') {
    devices = ['iphone'];
  } else if (options.device === 'ipad') {
    if (!config.devices.ipad) {
      console.error(chalk.red('Error: iPad not configured in aperture.config.yaml'));
      console.log(chalk.dim('Run aperture init to configure iPad, or use --device iphone\n'));
      process.exit(1);
    }
    devices = ['ipad'];
  } else {
    // Default to both, but only include iPad if configured
    devices = config.devices.ipad ? ['iphone', 'ipad'] : ['iphone'];

    if (!config.devices.ipad) {
      console.log(chalk.yellow('ℹ  iPad not configured, running iPhone only\n'));
    }
  }

  const totalRuns = locales.length * devices.length;
  let completedRuns = 0;
  let successfulRuns = 0;

  console.log(
    chalk.bold.blue(`🎬 Starting Aperture run: ${totalRuns} configuration(s)\n`)
  );

  // Initialize core components
  const deviceManager = new DeviceManager();
  const localeManager = new LocaleManager(deviceManager);
  const mcpClient = new MCPClient();
  const costTracker = new CostTracker();
  const aiNavigator = new AINavigator(
    config.llm.apiKey,
    config.llm.defaultModel,
    config.llm.escalationModel,
    config.llm.escalateAfterAttempts
  );

  // Main execution loop
  for (const locale of locales) {
    for (const deviceType of devices) {
      completedRuns++;
      const deviceName = deviceType === 'iphone' ? config.devices.iphone : config.devices.ipad!;

      console.log(
        chalk.bold(
          `\n[${completedRuns}/${totalRuns}] ${locale} - ${deviceType.toUpperCase()}`
        )
      );

      try {
        // Load locale data (if variables exist)
        const variables = flowParser.extractVariables(flow);
        let localeData: LocaleData = {};

        if (variables.size > 0) {
          const localeDataPath = resolve(process.cwd(), `locales/${locale}.yaml`);
          try {
            const localeDataContent = await readFile(localeDataPath, 'utf-8');
            localeData = YAML.parse(localeDataContent) as LocaleData;

            // Verify all variables are defined
            for (const varName of variables) {
              if (!(varName in localeData)) {
                throw new Error(`Variable {{${varName}}} not defined in ${locale}.yaml`);
              }
            }
          } catch (error) {
            console.error(chalk.yellow(`  ⚠ Warning: Could not load locale data for ${locale}`));
            console.error(chalk.dim(`    ${error}`));
          }
        }

        // Resolve variables in flow
        const resolvedFlow = flowParser.resolveVariables(flow, localeData);

        // Find device
        const availableDevices = await deviceManager.listDevices();
        const device = availableDevices.find((d) => d.name === deviceName);

        if (!device) {
          throw new Error(`Device not found: ${deviceName}`);
        }

        // Boot device first to check current locale
        const bootSpinner = ora(`Booting ${deviceName}...`).start();
        await deviceManager.boot(device.udid);
        bootSpinner.succeed(`Booted ${deviceName}`);

        // Check current locale and set if different from target
        const localeSpinner = ora(`Verifying locale ${locale}...`).start();
        try {
          const currentLocale = await localeManager.getCurrentLocale(device.udid);

          if (currentLocale !== locale) {
            localeSpinner.text = `Setting locale to ${locale} (current: ${currentLocale})...`;
            await localeManager.setLocale(device.udid, locale);
            localeSpinner.succeed(`Locale set to ${locale} (was: ${currentLocale})`);
          } else {
            localeSpinner.succeed(`Locale already set to ${locale}`);
          }
        } catch (error) {
          localeSpinner.warn(`Could not verify/set locale: ${error}`);
        }

        // Set status bar
        await deviceManager.setStatusBar(device.udid);

        // Install and launch app
        const appSpinner = ora('Installing app...').start();
        await deviceManager.install(device.udid, resolve(process.cwd(), config.app));

        const bundleId = await deviceManager.getBundleId(resolve(process.cwd(), config.app));
        await deviceManager.launch(device.udid, bundleId);
        appSpinner.succeed('App launched');

        // Connect to MCP
        const mcpSpinner = ora('Connecting to MCP server...').start();
        await mcpClient.connect(config.mcp.endpoint);
        mcpSpinner.succeed('MCP connected');

        // Execute flow
        const outputDir = join(config.output, locale, deviceType);
        await mkdir(outputDir, { recursive: true });

        for (let i = 0; i < resolvedFlow.steps.length; i++) {
          const step = resolvedFlow.steps[i];
          const stepNum = i + 1;

          if (options.dryRun) {
            console.log(
              chalk.dim(`  [${stepNum}/${resolvedFlow.steps.length}] DRY RUN: ${step.action}`)
            );
            continue;
          }

          const stepSpinner = ora(
            `[${stepNum}/${resolvedFlow.steps.length}] ${step.action}...`
          ).start();

          try {
            if (step.action === 'navigate') {
              const result = await aiNavigator.navigate(
                step.instruction,
                mcpClient,
                costTracker,
                {
                  maxActionsPerStep: config.guardrails.maxActionsPerStep,
                  stepTimeoutMs: config.guardrails.stepTimeoutSec * 1000,
                  runTimeoutMs: config.guardrails.runTimeoutSec * 1000,
                  forbiddenActions: config.guardrails.forbiddenActions,
                  costCapUsd: config.guardrails.costCapUsd,
                }
              );

              if (!result.success) {
                throw new Error(result.error ?? 'Navigation failed');
              }

              stepSpinner.succeed(
                `[${stepNum}/${resolvedFlow.steps.length}] navigate (${result.actionsExecuted} actions, ${costTracker.getFormattedCost()})`
              );

              if (options.verbose) {
                result.actionHistory.forEach((action, idx) => {
                  console.log(
                    chalk.dim(`    ${idx + 1}. ${action.action} - ${action.reasoning}`)
                  );
                });
              }
            } else if (step.action === 'action') {
              const result = await aiNavigator.navigate(
                step.instruction,
                mcpClient,
                costTracker,
                {
                  maxActionsPerStep: config.guardrails.maxActionsPerStep,
                  stepTimeoutMs: config.guardrails.stepTimeoutSec * 1000,
                  runTimeoutMs: config.guardrails.runTimeoutSec * 1000,
                  forbiddenActions: config.guardrails.forbiddenActions,
                  costCapUsd: config.guardrails.costCapUsd,
                }
              );

              if (!result.success) {
                throw new Error(result.error ?? 'Action failed');
              }

              stepSpinner.succeed(
                `[${stepNum}/${resolvedFlow.steps.length}] action (${result.actionsExecuted} actions, ${costTracker.getFormattedCost()})`
              );

              if (options.verbose) {
                result.actionHistory.forEach((action, idx) => {
                  console.log(
                    chalk.dim(`    ${idx + 1}. ${action.action} - ${action.reasoning}`)
                  );
                });
              }
            } else if (step.action === 'screenshot') {
              const screenshot = await mcpClient.takeScreenshot();
              const screenshotPath = join(outputDir, `${step.label}.png`);
              await writeFile(screenshotPath, screenshot);

              stepSpinner.succeed(
                `[${stepNum}/${resolvedFlow.steps.length}] screenshot → ${screenshotPath}`
              );
            } else if (step.action === 'type') {
              await mcpClient.type(step.text);
              stepSpinner.succeed(`[${stepNum}/${resolvedFlow.steps.length}] type`);
            } else if (step.action === 'wait') {
              const duration = step.duration ?? 1000;
              await new Promise((resolve) => setTimeout(resolve, duration));
              stepSpinner.succeed(
                `[${stepNum}/${resolvedFlow.steps.length}] wait (${duration}ms)`
              );
            }
          } catch (error) {
            stepSpinner.fail(
              `[${stepNum}/${resolvedFlow.steps.length}] ${step.action} failed`
            );
            console.error(
              chalk.red(`    Error: ${error instanceof Error ? error.message : error}`)
            );
          }
        }

        // Cleanup
        await mcpClient.disconnect();
        await deviceManager.terminate(device.udid, bundleId);

        successfulRuns++;
      } catch (error) {
        console.error(chalk.red(`  ✗ Failed: ${error instanceof Error ? error.message : error}`));
      }
    }
  }

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(chalk.bold.green(`\n✓ Completed in ${duration}s\n`));

  const summary = costTracker.getSummary();
  console.log(chalk.bold('Summary:'));
  console.log(`  Successful: ${successfulRuns}/${totalRuns}`);
  console.log(`  Total cost: ${chalk.cyan(costTracker.getFormattedCost())}`);
  console.log(`  Total tokens: ${summary.breakdown.reduce((sum, b) => sum + b.tokens, 0)}\n`);

  if (summary.breakdown.length > 0) {
    console.log(chalk.bold('Cost Breakdown:'));
    summary.breakdown.forEach((b) => {
      console.log(
        `  ${b.model}: ${b.calls} call(s), ${b.tokens} tokens, $${b.cost.toFixed(4)}`
      );
    });
    console.log();
  }

  process.exit(successfulRuns === totalRuns ? 0 : 1);
}
