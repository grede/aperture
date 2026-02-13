import pino from 'pino';
import path from 'path';
import fs from 'fs/promises';

/**
 * Creates a structured logger instance with context binding
 */
export function createLogger(name: string, options: LoggerOptions = {}) {
  const { level = 'info', prettyPrint = true, logFile } = options;

  const targets: pino.TransportTargetOptions[] = [];

  // Console output
  if (prettyPrint) {
    targets.push({
      target: 'pino-pretty',
      level,
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    });
  } else {
    targets.push({
      target: 'pino/file',
      level,
      options: { destination: 1 }, // stdout
    });
  }

  // File output
  if (logFile) {
    targets.push({
      target: 'pino/file',
      level: 'debug',
      options: { destination: logFile },
    });
  }

  const transport = pino.transport({
    targets,
  });

  return pino(
    {
      name,
      level,
    },
    transport
  );
}

/**
 * Logger options
 */
export interface LoggerOptions {
  level?: pino.Level;
  prettyPrint?: boolean;
  logFile?: string;
}

/**
 * Default logger instance
 */
export const logger = createLogger('aperture');

/**
 * Create a logger for a specific run with file output
 */
export async function createRunLogger(runId: string, logsDir = './logs') {
  // Ensure logs directory exists
  await fs.mkdir(logsDir, { recursive: true });

  const logFile = path.join(logsDir, `${runId}.json`);

  return createLogger(`run:${runId}`, {
    level: 'debug',
    prettyPrint: false,
    logFile,
  });
}
