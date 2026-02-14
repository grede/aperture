import { readFile, writeFile, mkdir } from 'fs/promises';
import { resolve, join } from 'path';
import { spawn } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import YAML from 'yaml';
import { FlowParser } from '../../core/flow-parser.js';
import { DeviceManager } from '../../core/device-manager.js';
import { ProviderFactory } from '../../core/providers/index.js';
import type { IMobileAutomationProvider } from '../../core/providers/index.js';
import { AINavigator } from '../../core/ai-navigator.js';
import { CostTracker } from '../../core/cost-tracker.js';
import { LocaleManager } from '../../core/locale-manager.js';
import type { ApertureConfig, FlowDefinition, LocaleData } from '../../types/index.js';

interface RunOptions {
  config?: string;
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

  // Load config
  const configPath = resolve(process.cwd(), options.config || 'aperture.config.yaml');
  let config: ApertureConfig;

  try {
    const configContent = await readFile(configPath, 'utf-8');
    config = YAML.parse(configContent) as ApertureConfig;

    if (options.config) {
      console.log(chalk.dim(`Using config: ${configPath}\n`));
    }

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

    // Validate app installation configuration
    const shouldInstall = config.installApp !== false; // Default to true if not specified
    if (shouldInstall && !config.app) {
      console.error(
        chalk.red('Error: app path is required when installApp is true (or not specified)')
      );
      console.log(chalk.dim('Either set installApp: false to use existing app, or provide app path\n'));
      process.exit(1);
    }
    if (!shouldInstall && !config.bundleId) {
      console.error(
        chalk.red('Error: bundleId is required when installApp is false')
      );
      console.log(chalk.dim('bundleId is needed to launch the existing app\n'));
      process.exit(1);
    }
  } catch (error) {
    console.error(
      chalk.red('Error loading config:'),
      error instanceof Error ? error.message : error
    );
    console.log(chalk.dim(`\nConfig file: ${configPath}`));
    console.log(chalk.dim(`Run ${chalk.cyan('aperture init')} to create a configuration.\n`));
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
  const costTracker = new CostTracker();
  const aiNavigator = new AINavigator(
    config.llm.apiKey,
    config.llm.defaultModel,
    config.llm.escalationModel,
    config.llm.escalateAfterAttempts
  );

  // Create mobile automation provider (e.g., mobile-mcp, appium, maestro)
  // The provider is determined from the endpoint in config
  let provider: IMobileAutomationProvider | null = null;

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
        let didReboot = false;
        try {
          const currentLocale = await localeManager.getCurrentLocale(device.udid);

          if (currentLocale !== locale) {
            localeSpinner.text = `Setting locale to ${locale} (current: ${currentLocale})...`;
            await localeManager.setLocale(device.udid, locale);
            didReboot = true;
            localeSpinner.succeed(`Locale set to ${locale} (was: ${currentLocale})`);
          } else {
            localeSpinner.succeed(`Locale already set to ${locale}`);
          }
        } catch (error) {
          localeSpinner.warn(`Could not verify/set locale: ${error}`);
        }

        // If we rebooted for locale change, wait for simulator to fully stabilize
        if (didReboot) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }

        // Set status bar
        await deviceManager.setStatusBar(device.udid);

        // Don't manually start WebDriverAgent - let mobile-mcp handle it
        // This avoids conflicts between our WDA process and mobile-mcp's WDA management

        // Install and/or launch app based on configuration
        const shouldInstall = config.installApp !== false; // Default to true
        let bundleId: string;

        if (shouldInstall) {
          const appSpinner = ora('Installing app...').start();
          await deviceManager.install(device.udid, resolve(process.cwd(), config.app!));
          bundleId = await deviceManager.getBundleId(resolve(process.cwd(), config.app!));
          await deviceManager.launch(device.udid, bundleId);
          appSpinner.succeed('App installed and launched');
        } else {
          const appSpinner = ora('Launching existing app...').start();
          bundleId = config.bundleId;
          await deviceManager.launch(device.udid, bundleId);
          appSpinner.succeed(`App launched (${bundleId})`);
        }

        // Connect to mobile automation provider (e.g., MCP server)
        const providerSpinner = ora('Connecting to mobile automation provider...').start();

        // Create provider from endpoint (auto-detects provider type)
        const providerType = config.mcp.endpoint.replace('stdio://', '');
        provider = ProviderFactory.create({
          type: providerType,
          endpoint: config.mcp.endpoint,
        });

        await provider.connect(config.mcp.endpoint);
        providerSpinner.text = `Initializing iOS simulator (${provider.getProviderInfo().name})...`;

        // Give provider time to start WebDriverAgent after locale changes
        await provider.initializeDevice(device.udid);
        providerSpinner.succeed(`Provider connected (${provider.getProviderInfo().name})`);

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
                provider!,
                costTracker,
                {
                  maxActionsPerStep: config.guardrails.maxActionsPerStep,
                  stepTimeoutMs: config.guardrails.stepTimeoutSec * 1000,
                  runTimeoutMs: config.guardrails.runTimeoutSec * 1000,
                  forbiddenActions: config.guardrails.forbiddenActions,
                  costCapUsd: config.guardrails.costCapUsd,
                  noProgressThreshold: config.guardrails.noProgressThreshold ?? 5,
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
                provider!,
                costTracker,
                {
                  maxActionsPerStep: config.guardrails.maxActionsPerStep,
                  stepTimeoutMs: config.guardrails.stepTimeoutSec * 1000,
                  runTimeoutMs: config.guardrails.runTimeoutSec * 1000,
                  forbiddenActions: config.guardrails.forbiddenActions,
                  costCapUsd: config.guardrails.costCapUsd,
                  noProgressThreshold: config.guardrails.noProgressThreshold ?? 5,
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
              const screenshot = await provider!.takeScreenshot();
              const screenshotPath = join(outputDir, `${step.label}.png`);
              await writeFile(screenshotPath, screenshot);

              stepSpinner.succeed(
                `[${stepNum}/${resolvedFlow.steps.length}] screenshot → ${screenshotPath}`
              );
            } else if (step.action === 'type') {
              await provider!.type(step.text);
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
            // Stop execution on step failure - don't continue to next step
            throw error;
          }
        }

        // Cleanup
        if (provider) {
          await provider.disconnect();
        }
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
