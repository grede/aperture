import { Worker, Job as BullJob } from 'bullmq';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type { Job, JobConfig } from '../types.js';
import { FlowParser } from '../../core/flow-parser.js';
import { DeviceManager } from '../../core/device-manager.js';
import { MCPClient } from '../../core/mcp-client.js';
import { AINavigator } from '../../core/ai-navigator.js';
import { CostTracker } from '../../core/cost-tracker.js';
import { SimulatorPool } from '../pool/simulator-pool.js';

// ── JobWorker Class ────────────────────────────────────────────

export class JobWorker {
  private worker: Worker;
  private pool: SimulatorPool;
  private deviceManager: DeviceManager;

  constructor(
    redisConnection: { host: string; port: number },
    pool: SimulatorPool,
    deviceManager: DeviceManager
  ) {
    this.pool = pool;
    this.deviceManager = deviceManager;

    this.worker = new Worker(
      'aperture-jobs',
      async (job: BullJob<JobConfig>) => {
        return this.processJob(job);
      },
      {
        connection: redisConnection,
        concurrency: 4, // Process up to 4 jobs concurrently
      }
    );

    this.worker.on('completed', (job) => {
      console.log(`[Worker] Job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`[Worker] Job ${job?.id} failed:`, err);
    });
  }

  /**
   * Process a job
   */
  private async processJob(job: BullJob<JobConfig>): Promise<Job> {
    const jobId = job.id!;
    const config = job.data;

    console.log(`[Worker] Processing job ${jobId}`);

    // Create temporary workspace
    const workspaceDir = await mkdtemp(join(tmpdir(), `aperture-job-${jobId}-`));

    // Acquire simulators from pool
    const simulators = await this.pool.acquire(jobId);

    try {
      // Parse flow
      const flowParser = new FlowParser();
      const flow = await flowParser.parse(join(workspaceDir, 'flow.yaml'));

      // Initialize components
      const mcpClient = new MCPClient();
      const costTracker = new CostTracker();
      const aiNavigator = new AINavigator(
        process.env.OPENAI_API_KEY ?? '',
        'gpt-4o-mini',
        'gpt-4o',
        5
      );

      const totalRuns = config.locales.length * config.devices.length;
      let completedRuns = 0;
      const screenshots: string[] = [];

      // Execute flow for each locale and device
      for (const locale of config.locales) {
        for (const deviceType of config.devices) {
          const deviceUdid = deviceType === 'iphone' ? simulators.iphone : simulators.ipad;

          // Update progress
          await job.updateProgress({
            current: completedRuns,
            total: totalRuns,
            currentLocale: locale,
            currentDevice: deviceType,
          });

          // Execute flow (simplified version - would need full implementation)
          // This is a placeholder showing the structure

          completedRuns++;
        }
      }

      // Cleanup
      await mcpClient.disconnect();
      await rm(workspaceDir, { recursive: true, force: true });
      await this.pool.release([simulators.iphone, simulators.ipad]);

      return {
        id: jobId,
        config,
        status: 'completed',
        createdAt: new Date(job.timestamp),
        completedAt: new Date(),
        progress: {
          current: totalRuns,
          total: totalRuns,
        },
        cost: costTracker.getTotalCost(),
        screenshots,
      };
    } catch (error) {
      // Cleanup on error
      await rm(workspaceDir, { recursive: true, force: true });
      await this.pool.release([simulators.iphone, simulators.ipad]);

      throw error;
    }
  }

  /**
   * Gracefully shutdown the worker
   */
  async shutdown(): Promise<void> {
    await this.worker.close();
  }
}
