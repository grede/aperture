import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

let envLoaded = false;

/**
 * Ensure web runtime picks up env files from both the Next app dir and repo root.
 */
export function ensureWebEnvLoaded(): void {
  if (envLoaded) {
    return;
  }
  envLoaded = true;

  if (typeof process.loadEnvFile !== 'function') {
    return;
  }

  const roots = [
    process.cwd(),
    resolve(process.cwd(), '..'),
    resolve(process.cwd(), '..', '..'),
  ];

  const envFiles = ['.env.local', '.env'];

  for (const root of roots) {
    for (const envFile of envFiles) {
      const filePath = resolve(root, envFile);
      if (!existsSync(filePath)) {
        continue;
      }

      try {
        process.loadEnvFile(filePath);
      } catch {
        // Ignore unreadable/invalid env files and keep checking candidates.
      }
    }
  }
}
