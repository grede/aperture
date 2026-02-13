import { webServer } from '../../web/server.js';
import { logger } from '../../utils/logger.js';
import { error, success, header } from '../ui.js';

/**
 * Web command options
 */
export interface WebOptions {
  port?: number;
}

/**
 * Start web UI server (US-020, US-021)
 */
export async function webCommand(options: WebOptions = {}) {
  try {
    header('Starting Web UI');

    const port = options.port || 3000;

    console.log();
    console.log('Starting web server...');
    console.log();

    await webServer.start();

    console.log();
    success('Web UI is ready!');
    console.log();
    console.log('Access the UI at:');
    console.log(`  Recorder: http://localhost:${port}/recorder`);
    console.log(`  Preview:  http://localhost:${port}/preview`);
    console.log();
    console.log('Press Ctrl+C to stop the server');
    console.log();

    // Keep process alive
    await new Promise(() => {});
  } catch (err) {
    logger.error({ error: err }, 'Web command failed');
    error(`Failed to start web server: ${(err as Error).message}`);
    process.exit(1);
  }
}
