import express from 'express';
import { Queue } from 'bullmq';
import { DeviceManager } from '../core/device-manager.js';
import { SimulatorPool } from './pool/simulator-pool.js';
import { JobWorker } from './queue/job-worker.js';
import { createJobsRouter } from './routes/jobs.js';

// ── Server Configuration ───────────────────────────────────────

const REDIS_CONFIG = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379'),
};

const POOL_CONFIG = {
  iPhoneCount: parseInt(process.env.POOL_IPHONE_COUNT ?? '4'),
  iPadCount: parseInt(process.env.POOL_IPAD_COUNT ?? '4'),
};

const PORT = parseInt(process.env.PORT ?? '3000');

// ── Server Class ───────────────────────────────────────────────

export class ApertureServer {
  private app: express.Application;
  private jobQueue: Queue;
  private worker: JobWorker;
  private pool: SimulatorPool;
  private deviceManager: DeviceManager;

  constructor() {
    this.app = express();
    this.deviceManager = new DeviceManager();

    // Initialize job queue
    this.jobQueue = new Queue('aperture-jobs', {
      connection: REDIS_CONFIG,
    });

    // Initialize simulator pool
    this.pool = new SimulatorPool(this.deviceManager);

    // Initialize worker
    this.worker = new JobWorker(REDIS_CONFIG, this.pool, this.deviceManager);

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    this.app.use(express.json());

    // API key authentication middleware
    this.app.use('/api', (req, res, next) => {
      const apiKey = req.headers['x-api-key'];

      if (!apiKey) {
        return res.status(401).json({
          error: 'Missing API key',
        });
      }

      // Simple API key validation (in production, use a database)
      const validApiKey = process.env.API_KEY ?? 'aperture-dev-key';

      if (apiKey !== validApiKey) {
        return res.status(401).json({
          error: 'Invalid API key',
        });
      }

      next();
    });

    // CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-API-Key');
      next();
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      const poolStatus = this.pool.getStatus();

      res.json({
        status: 'ok',
        pool: poolStatus,
        queue: {
          name: this.jobQueue.name,
        },
      });
    });

    // API routes
    this.app.use('/api', createJobsRouter(this.jobQueue));

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not found',
      });
    });
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    // Initialize simulator pool
    console.log('[Server] Initializing simulator pool...');
    await this.pool.initialize(POOL_CONFIG.iPhoneCount, POOL_CONFIG.iPadCount);

    // Start Express server
    this.app.listen(PORT, () => {
      console.log(`[Server] Aperture server running on port ${PORT}`);
      console.log(`[Server] Health check: http://localhost:${PORT}/health`);
      console.log(`[Server] API: http://localhost:${PORT}/api/jobs`);
    });
  }

  /**
   * Gracefully shutdown the server
   */
  async shutdown(): Promise<void> {
    console.log('[Server] Shutting down...');

    await this.worker.shutdown();
    await this.pool.shutdown();
    await this.jobQueue.close();

    console.log('[Server] Shutdown complete');
  }
}

// ── Main Entry Point ───────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new ApertureServer();

  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    await server.shutdown();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await server.shutdown();
    process.exit(0);
  });

  server.start().catch((error) => {
    console.error('[Server] Fatal error:', error);
    process.exit(1);
  });
}
