import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { appiumManager } from '../../core/appium-manager.js';
import { logger } from '../../utils/logger.js';

export const serverCommand = new Command('server')
  .description('Manage Appium server lifecycle')
  .addCommand(
    new Command('start')
      .description('Start Appium server')
      .option('-p, --port <port>', 'Port to run Appium server on', '8100')
      .action(async (options) => {
        const spinner = ora('Starting Appium server...').start();
        try {
          if (await appiumManager.isRunning()) {
            const status = await appiumManager.getStatus();
            spinner.succeed(chalk.green(`Appium server already running on port ${status.port} (PID: ${status.pid})`));
            return;
          }

          const port = parseInt(options.port, 10);
          const processInfo = await appiumManager.start(port);
          spinner.succeed(chalk.green(`Appium server started on port ${processInfo.port} (PID: ${processInfo.pid})`));
          console.log(chalk.dim(`  Log file: ${processInfo.logFile}`));
          console.log(chalk.dim(`  View logs: aperture server logs`));
        } catch (error) {
          spinner.fail(chalk.red('Failed to start Appium server'));
          logger.error('Server start failed', { error });
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('stop')
      .description('Stop Appium server')
      .action(async () => {
        const spinner = ora('Stopping Appium server...').start();
        try {
          if (!(await appiumManager.isRunning())) {
            spinner.info(chalk.yellow('Appium server is not running'));
            return;
          }

          await appiumManager.stop();
          spinner.succeed(chalk.green('Appium server stopped'));
        } catch (error) {
          spinner.fail(chalk.red('Failed to stop Appium server'));
          logger.error('Server stop failed', { error });
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('restart')
      .description('Restart Appium server')
      .option('-p, --port <port>', 'Port to run Appium server on', '8100')
      .action(async (options) => {
        const spinner = ora('Restarting Appium server...').start();
        try {
          if (await appiumManager.isRunning()) {
            await appiumManager.stop();
            spinner.text = 'Waiting before restart...';
            await new Promise(r => setTimeout(r, 2000));
          }

          const port = parseInt(options.port, 10);
          const processInfo = await appiumManager.start(port);
          spinner.succeed(chalk.green(`Appium server restarted on port ${processInfo.port} (PID: ${processInfo.pid})`));
        } catch (error) {
          spinner.fail(chalk.red('Failed to restart Appium server'));
          logger.error('Server restart failed', { error });
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('status')
      .description('Show Appium server status')
      .action(async () => {
        try {
          const status = await appiumManager.getStatus();

          if (status.running) {
            console.log(chalk.green('✓ Appium server is running'));
            console.log(chalk.dim(`  Port: ${status.port}`));
            console.log(chalk.dim(`  PID: ${status.pid}`));
            if (status.uptime) {
              const uptimeSeconds = Math.floor(status.uptime / 1000);
              const minutes = Math.floor(uptimeSeconds / 60);
              const seconds = uptimeSeconds % 60;
              console.log(chalk.dim(`  Uptime: ${minutes}m ${seconds}s`));
            }
          } else {
            console.log(chalk.yellow('✗ Appium server is not running'));
          }
        } catch (error) {
          logger.error('Failed to get server status', { error });
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('logs')
      .description('Show Appium server logs')
      .option('-n, --lines <number>', 'Number of log lines to show', '50')
      .action(async (options) => {
        try {
          const lines = parseInt(options.lines, 10);
          const logs = await appiumManager.getLogs(lines);
          console.log(logs);
        } catch (error) {
          logger.error('Failed to read logs', { error });
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('install')
      .description('Install Appium and XCUITest driver')
      .action(async () => {
        const spinner = ora('Checking Appium installation...').start();
        try {
          if (await appiumManager.isInstalled()) {
            spinner.info(chalk.yellow('Appium is already installed'));
            return;
          }

          await appiumManager.install((message) => {
            spinner.text = message;
          });
          spinner.succeed(chalk.green('Appium installed successfully'));
        } catch (error) {
          spinner.fail(chalk.red('Failed to install Appium'));
          logger.error('Installation failed', { error });
          console.log(chalk.yellow('\nManual installation:'));
          console.log(chalk.dim('  npm install --save-dev appium'));
          console.log(chalk.dim('  npx appium driver install xcuitest'));
          process.exit(1);
        }
      })
  );
