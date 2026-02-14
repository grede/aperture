import { spawn } from 'child_process';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { readFile, stat } from 'fs/promises';
import YAML from 'yaml';
import { resolve, join } from 'path';
import { homedir } from 'os';
import { MCPClient } from '../../core/mcp-client.js';

interface DoctorOptions {
  fix?: boolean;
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

/**
 * Install mobile-mcp via npm
 */
async function installMobileMcp(): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(chalk.dim('\n  Installing mobile-mcp globally via npm...\n'));

    const proc = spawn('npm', ['install', '-g', 'mobile-mcp'], {
      stdio: 'inherit',
    });

    proc.on('close', (code) => {
      resolve(code === 0);
    });

    proc.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Clone WebDriverAgent from GitHub
 */
async function cloneWebDriverAgent(): Promise<boolean> {
  return new Promise((resolve) => {
    const wdaPath = join(homedir(), 'WebDriverAgent');
    console.log(chalk.dim('\n  Cloning WebDriverAgent to ~/WebDriverAgent...\n'));

    const proc = spawn(
      'git',
      ['clone', '--depth', '1', 'https://github.com/appium/WebDriverAgent.git', wdaPath],
      {
        stdio: 'inherit',
      }
    );

    proc.on('close', (code) => {
      resolve(code === 0);
    });

    proc.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Build WebDriverAgent for a specific device
 */
async function buildWebDriverAgent(deviceName: string): Promise<boolean> {
  return new Promise((resolve) => {
    const wdaPath = join(homedir(), 'WebDriverAgent');
    console.log(chalk.dim(`\n  Building WebDriverAgent for ${deviceName}...\n`));

    const proc = spawn(
      'xcodebuild',
      [
        '-project',
        join(wdaPath, 'WebDriverAgent.xcodeproj'),
        '-scheme',
        'WebDriverAgentRunner',
        '-destination',
        `platform=iOS Simulator,name=${deviceName}`,
        'build-for-testing',
      ],
      {
        stdio: 'inherit',
        cwd: wdaPath,
      }
    );

    proc.on('close', (code) => {
      resolve(code === 0);
    });

    proc.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Check system requirements and dependencies
 */
export async function doctorCommand(options: DoctorOptions): Promise<void> {
  console.log(chalk.bold.blue('\n🏥 Aperture Doctor\n'));
  console.log(chalk.dim('Checking system requirements...\n'));

  let hasIssues = false;

  // Check Node.js version
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0], 10);

  console.log(chalk.bold('Node.js'));
  if (nodeMajor >= 20) {
    console.log(chalk.green(`  ✓ Node.js ${nodeVersion} (>= 20 required)\n`));
  } else {
    console.log(chalk.red(`  ✗ Node.js ${nodeVersion} (>= 20 required)\n`));
    console.log(chalk.yellow(`    Please upgrade Node.js: https://nodejs.org/\n`));
    hasIssues = true;
  }

  // Check for Xcode/xcrun
  console.log(chalk.bold('Xcode Command Line Tools'));
  const hasXcrun = await commandExists('xcrun');

  if (hasXcrun) {
    console.log(chalk.green('  ✓ xcrun found (Xcode tools installed)\n'));
  } else {
    console.log(chalk.red('  ✗ xcrun not found (Xcode tools required)\n'));
    console.log(chalk.yellow('    Install Xcode from App Store or run:'));
    console.log(chalk.cyan('    xcode-select --install\n'));
    hasIssues = true;
  }

  // Check for npm (needed for mobile-mcp installation)
  console.log(chalk.bold('npm'));
  const hasNpm = await commandExists('npm');

  if (hasNpm) {
    console.log(chalk.green('  ✓ npm found in PATH\n'));
  } else {
    console.log(chalk.red('  ✗ npm not found (required to install mobile-mcp)\n'));
    hasIssues = true;
  }

  // Check for WebDriverAgent (required for mobile-mcp iOS support)
  console.log(chalk.bold('WebDriverAgent for iOS'));
  const wdaPath = join(homedir(), 'WebDriverAgent');
  let wdaExists = false;

  try {
    await stat(wdaPath);
    wdaExists = true;
  } catch {
    wdaExists = false;
  }

  if (wdaExists) {
    console.log(chalk.green(`  ✓ WebDriverAgent found at ${wdaPath}\n`));
    console.log(chalk.dim('  WebDriverAgent will start automatically when running aperture run\n'));
  } else {
    console.log(chalk.red(`  ✗ WebDriverAgent not found at ${wdaPath}\n`));
    console.log(chalk.yellow('    WebDriverAgent is required for mobile-mcp to control iOS Simulators\n'));
    hasIssues = true;

    // Offer to install if --fix or interactive mode
    if (options.fix) {
      const cloneSpinner = ora('Cloning WebDriverAgent...').start();
      const cloned = await cloneWebDriverAgent();

      if (cloned) {
        cloneSpinner.succeed('WebDriverAgent cloned successfully');

        // Get device name from config or use default
        let deviceName = 'iPhone 17 Pro Max';

        try {
          const configPath = resolve(process.cwd(), 'aperture.config.yaml');
          const configContent = await readFile(configPath, 'utf-8');
          const config = YAML.parse(configContent);
          if (config?.devices?.iphone) {
            deviceName = config.devices.iphone;
          }
        } catch {
          // Config not found, use default
        }

        const buildSpinner = ora(`Building WebDriverAgent for ${deviceName}...`).start();
        const built = await buildWebDriverAgent(deviceName);

        if (built) {
          buildSpinner.succeed('WebDriverAgent built successfully');
          console.log(chalk.green('\n  WebDriverAgent is ready!\n'));
          console.log(chalk.dim('  It will start automatically when you run aperture run\n'));
          hasIssues = false; // Fixed the issue
        } else {
          buildSpinner.fail('Failed to build WebDriverAgent');
          console.log(chalk.yellow('\n  Please build it manually:'));
          console.log(chalk.cyan(`  cd ${wdaPath}`));
          console.log(chalk.cyan('  xcodebuild -project WebDriverAgent.xcodeproj \\'));
          console.log(chalk.cyan('             -scheme WebDriverAgentRunner \\'));
          console.log(chalk.cyan('             -destination \'platform=iOS Simulator,name=YOUR_DEVICE\' \\'));
          console.log(chalk.cyan('             build-for-testing\n'));
        }
      } else {
        cloneSpinner.fail('Failed to clone WebDriverAgent');
        console.log(chalk.yellow('\n  Please clone it manually:'));
        console.log(chalk.cyan('  git clone --depth 1 https://github.com/appium/WebDriverAgent.git ~/WebDriverAgent\n'));
      }
    } else {
      // Interactive mode - ask user
      const { install } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'install',
          message: 'Would you like to clone and build WebDriverAgent now?',
          default: true,
        },
      ]);

      if (install) {
        const cloned = await cloneWebDriverAgent();

        if (cloned) {
          console.log(chalk.green('\n✓ WebDriverAgent cloned successfully\n'));

          // Get device name from config or prompt
          let deviceName = 'iPhone 17 Pro Max';

          try {
            const configPath = resolve(process.cwd(), 'aperture.config.yaml');
            const configContent = await readFile(configPath, 'utf-8');
            const config = YAML.parse(configContent);
            if (config?.devices?.iphone) {
              deviceName = config.devices.iphone;
            }
          } catch {
            // Config not found, prompt for device
            const { device } = await inquirer.prompt([
              {
                type: 'input',
                name: 'device',
                message: 'Enter the iOS Simulator device name to build for:',
                default: 'iPhone 17 Pro Max',
              },
            ]);
            deviceName = device;
          }

          const built = await buildWebDriverAgent(deviceName);

          if (built) {
            console.log(chalk.green('\n✓ WebDriverAgent built successfully\n'));
            console.log(chalk.dim('  It will start automatically when you run aperture run\n'));
            hasIssues = false; // Fixed the issue
          } else {
            console.log(chalk.red('\n✗ Failed to build WebDriverAgent\n'));
            console.log(chalk.yellow('  Please build it manually:'));
            console.log(chalk.cyan(`  cd ${wdaPath}`));
            console.log(chalk.cyan('  xcodebuild -project WebDriverAgent.xcodeproj \\'));
            console.log(chalk.cyan('             -scheme WebDriverAgentRunner \\'));
            console.log(chalk.cyan('             -destination \'platform=iOS Simulator,name=YOUR_DEVICE\' \\'));
            console.log(chalk.cyan('             build-for-testing\n'));
          }
        } else {
          console.log(chalk.red('\n✗ Failed to clone WebDriverAgent\n'));
          console.log(chalk.yellow('  Please clone it manually:'));
          console.log(chalk.cyan('  git clone --depth 1 https://github.com/appium/WebDriverAgent.git ~/WebDriverAgent\n'));
        }
      } else {
        console.log(chalk.yellow('\n  You can clone it later with:'));
        console.log(chalk.cyan('  git clone --depth 1 https://github.com/appium/WebDriverAgent.git ~/WebDriverAgent\n'));
      }
    }
  }

  // Check for mobile-mcp
  console.log(chalk.bold('MCP Server (mobile-mcp)'));
  const hasMobileMcp = await commandExists('mobile-mcp');

  if (hasMobileMcp) {
    console.log(chalk.green('  ✓ mobile-mcp found in PATH\n'));
  } else {
    console.log(chalk.red('  ✗ mobile-mcp not found in PATH\n'));
    console.log(chalk.yellow('    mobile-mcp is required to control iOS Simulators\n'));
    hasIssues = true;

    // Offer to install if --fix or interactive mode
    if (options.fix) {
      const spinner = ora('Installing mobile-mcp...').start();
      const success = await installMobileMcp();

      if (success) {
        spinner.succeed('mobile-mcp installed successfully');
      } else {
        spinner.fail('Failed to install mobile-mcp');
        console.log(chalk.yellow('\n  Please install manually:'));
        console.log(chalk.cyan('  npm install -g mobile-mcp\n'));
      }
    } else {
      const { install } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'install',
          message: 'Would you like to install mobile-mcp now?',
          default: true,
        },
      ]);

      if (install) {
        const success = await installMobileMcp();

        if (success) {
          console.log(chalk.green('\n✓ mobile-mcp installed successfully\n'));
          hasIssues = false; // Fixed the issue
        } else {
          console.log(chalk.red('\n✗ Failed to install mobile-mcp\n'));
          console.log(chalk.yellow('  Please install manually:'));
          console.log(chalk.cyan('  npm install -g mobile-mcp\n'));
        }
      } else {
        console.log(chalk.yellow('\n  You can install it later with:'));
        console.log(chalk.cyan('  npm install -g mobile-mcp\n'));
      }
    }
  }

  // Test MCP connection if mobile-mcp is available
  if (hasMobileMcp || !hasIssues) {
    console.log(chalk.bold('MCP Server Connection Test'));
    const mcpSpinner = ora('Testing connection to mobile-mcp...').start();

    try {
      const mcpClient = new MCPClient();
      await mcpClient.connect('stdio://mobile-mcp');

      const tools = await mcpClient.listTools();
      mcpSpinner.succeed('MCP server connection successful');

      console.log(chalk.dim(`\n  Available MCP tools (${tools.length}):\n`));
      tools.forEach((tool) => {
        console.log(chalk.cyan(`    • ${tool.name}`) + (tool.description ? chalk.dim(` - ${tool.description}`) : ''));
      });
      console.log();

      await mcpClient.disconnect();
    } catch (error) {
      mcpSpinner.fail('MCP server connection failed');
      console.log(chalk.red(`\n  Error: ${error instanceof Error ? error.message : error}\n`));
      console.log(chalk.yellow('  This may indicate:'));
      console.log(chalk.dim('    - mobile-mcp is not properly installed'));
      console.log(chalk.dim('    - mobile-mcp is not in PATH'));
      console.log(chalk.dim('    - Incompatible mobile-mcp version\n'));
      hasIssues = true;
    }
  }

  // Summary
  if (!hasIssues) {
    console.log(chalk.bold.green('✓ All checks passed!\n'));
    console.log(chalk.dim('You\'re ready to run Aperture.\n'));
  } else {
    console.log(chalk.bold.yellow('⚠  Some issues need attention\n'));
    console.log(chalk.dim('Fix the issues above before running Aperture.\n'));
    process.exit(1);
  }
}
