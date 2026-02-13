import { Command } from 'commander';
import { existsSync } from 'fs';
import { exec } from '../../utils/exec.js';
import { success, error, warning, info, header } from '../ui.js';

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
  fix?: string;
}

async function checkNodeVersion(): Promise<CheckResult> {
  try {
    const result = await exec('node', ['--version'], { logCommand: false });
    const version = result.stdout;
    const major = parseInt(version.slice(1).split('.')[0]);

    if (major >= 18) {
      return {
        name: 'Node.js Version',
        passed: true,
        message: `${version} (>= 18.0.0 required)`,
      };
    } else {
      return {
        name: 'Node.js Version',
        passed: false,
        message: `${version} (18.0.0+ required)`,
        fix: 'Install Node.js 18+ from https://nodejs.org',
      };
    }
  } catch (err) {
    return {
      name: 'Node.js',
      passed: false,
      message: 'Not found',
      fix: 'Install Node.js from https://nodejs.org',
    };
  }
}

async function checkXcode(): Promise<CheckResult> {
  try {
    const result = await exec('xcode-select', ['-p'], { logCommand: false });
    const path = result.stdout;

    if (path && existsSync(path)) {
      return {
        name: 'Xcode Command Line Tools',
        passed: true,
        message: `Installed at ${path}`,
      };
    } else {
      return {
        name: 'Xcode Command Line Tools',
        passed: false,
        message: 'Path not found',
        fix: 'Run: xcode-select --install',
      };
    }
  } catch (err) {
    return {
      name: 'Xcode Command Line Tools',
      passed: false,
      message: 'Not installed',
      fix: 'Run: xcode-select --install',
    };
  }
}

async function checkAppium(): Promise<CheckResult> {
  try {
    const result = await exec('npx', ['appium', '--version'], { logCommand: false });
    // Appium writes to stderr
    const version = result.stderr || result.stdout;

    if (version.startsWith('2.')) {
      return {
        name: 'Appium',
        passed: true,
        message: `Version ${version}`,
      };
    } else {
      return {
        name: 'Appium',
        passed: false,
        message: `Version ${version} (2.x required)`,
        fix: 'Run: npm install',
      };
    }
  } catch (err) {
    return {
      name: 'Appium',
      passed: false,
      message: 'Not found',
      fix: 'Run: npm install',
    };
  }
}

async function checkXCUITestDriver(): Promise<CheckResult> {
  try {
    const result = await exec('npx', ['appium', 'driver', 'list', '--installed'], { logCommand: false });

    // Appium writes to stderr, strip ANSI color codes for parsing
    const output = result.stderr || result.stdout;
    const cleanOutput = output.replace(/\x1b\[\d+m/g, '');

    if (cleanOutput.includes('xcuitest')) {
      const match = cleanOutput.match(/xcuitest@([\d.]+)/);
      const version = match ? match[1] : 'unknown';
      return {
        name: 'XCUITest Driver',
        passed: true,
        message: `Version ${version}`,
      };
    } else {
      return {
        name: 'XCUITest Driver',
        passed: false,
        message: 'Not installed',
        fix: 'Run: npm install',
      };
    }
  } catch (err) {
    return {
      name: 'XCUITest Driver',
      passed: false,
      message: 'Could not check',
      fix: 'Run: npm install',
    };
  }
}

async function checkWebDriverAgent(): Promise<CheckResult> {
  try {
    // Check for WDA builds in Xcode DerivedData
    const result = await exec(
      'find',
      [
        `${process.env.HOME}/Library/Developer/Xcode/DerivedData`,
        '-name',
        'WebDriverAgent-*',
        '-maxdepth',
        '1',
      ],
      { logCommand: false }
    );

    if (result.stdout) {
      return {
        name: 'WebDriverAgent',
        passed: true,
        message: 'Built and ready',
      };
    } else {
      return {
        name: 'WebDriverAgent',
        passed: false,
        message: 'Not built',
        fix: 'Run: npx appium driver run xcuitest build-wda',
      };
    }
  } catch (err) {
    return {
      name: 'WebDriverAgent',
      passed: false,
      message: 'Not built',
      fix: 'Run: npx appium driver run xcuitest build-wda',
    };
  }
}

async function checkSimulators(): Promise<CheckResult> {
  try {
    const result = await exec('xcrun', ['simctl', 'list', 'devices', 'available'], { logCommand: false });
    const simulators = result.stdout.split('\n').filter((line) => line.includes('iPhone') || line.includes('iPad'));

    if (simulators.length > 0) {
      return {
        name: 'iOS Simulators',
        passed: true,
        message: `${simulators.length} available`,
      };
    } else {
      return {
        name: 'iOS Simulators',
        passed: false,
        message: 'None available',
        fix: 'Install iOS simulators via Xcode > Settings > Platforms',
      };
    }
  } catch (err) {
    return {
      name: 'iOS Simulators',
      passed: false,
      message: 'Could not check',
      fix: 'Ensure Xcode is installed',
    };
  }
}

export function createDoctorCommand(): Command {
  const command = new Command('doctor');

  command
    .description('Check system requirements and setup')
    .action(async () => {
      header('Aperture Setup Verification');

      const checks: CheckResult[] = [];

      // Run all checks
      info('Running diagnostics...\n');

      checks.push(await checkNodeVersion());
      checks.push(await checkXcode());
      checks.push(await checkAppium());
      checks.push(await checkXCUITestDriver());
      checks.push(await checkWebDriverAgent());
      checks.push(await checkSimulators());

      // Display results
      console.log('');
      for (const check of checks) {
        const symbol = check.passed ? '✓' : '✗';
        const color = check.passed ? success : error;

        color(`${symbol} ${check.name}`);
        console.log(`  ${check.message}`);

        if (check.fix) {
          warning(`  Fix: ${check.fix}`);
        }
        console.log('');
      }

      // Summary
      const passedCount = checks.filter((c) => c.passed).length;
      const totalCount = checks.length;

      console.log('─'.repeat(50));

      if (passedCount === totalCount) {
        success(`\n✓ All checks passed! Aperture is ready to use.`);
        info('\nRun "aperture init" to get started.\n');
      } else {
        error(`\n✗ ${totalCount - passedCount} check(s) failed.`);
        warning('\nPlease fix the issues above before using Aperture.\n');
        info('See the README for detailed setup instructions:');
        info('https://github.com/your-org/aperture#installation\n');
        process.exit(1);
      }
    });

  return command;
}
