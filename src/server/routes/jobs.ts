import { Router } from 'express';
import { Queue } from 'bullmq';
import type { JobConfig } from '../types.js';

export function createJobsRouter(jobQueue: Queue): Router {
  const router = Router();

  /**
   * POST /api/jobs - Create a new job
   */
  router.post('/jobs', async (req, res) => {
    try {
      const config: JobConfig = req.body;

      // Validate config
      if (!config.appPath || !config.flowYaml) {
        return res.status(400).json({
          error: 'Missing required fields: appPath, flowYaml',
        });
      }

      // Add job to queue
      const job = await jobQueue.add('screenshot-job', config, {
        removeOnComplete: {
          age: 86400, // Keep for 24 hours
        },
        removeOnFail: {
          age: 86400,
        },
      });

      res.status(201).json({
        id: job.id,
        status: 'pending',
        createdAt: new Date(job.timestamp),
      });
    } catch (error) {
      console.error('[API] Error creating job:', error);
      res.status(500).json({
        error: 'Failed to create job',
      });
    }
  });

  /**
   * GET /api/jobs/:id - Get job status
   */
  router.get('/jobs/:id', async (req, res) => {
    try {
      const job = await jobQueue.getJob(req.params.id);

      if (!job) {
        return res.status(404).json({
          error: 'Job not found',
        });
      }

      const state = await job.getState();
      const progress = job.progress as any;

      res.json({
        id: job.id,
        status: state,
        createdAt: new Date(job.timestamp),
        progress,
      });
    } catch (error) {
      console.error('[API] Error fetching job:', error);
      res.status(500).json({
        error: 'Failed to fetch job',
      });
    }
  });

  /**
   * DELETE /api/jobs/:id - Cancel a job
   */
  router.delete('/jobs/:id', async (req, res) => {
    try {
      const job = await jobQueue.getJob(req.params.id);

      if (!job) {
        return res.status(404).json({
          error: 'Job not found',
        });
      }

      await job.remove();

      res.json({
        message: 'Job cancelled',
      });
    } catch (error) {
      console.error('[API] Error cancelling job:', error);
      res.status(500).json({
        error: 'Failed to cancel job',
      });
    }
  });

  /**
   * GET /api/jobs - List all jobs
   */
  router.get('/jobs', async (req, res) => {
    try {
      const jobs = await jobQueue.getJobs(['waiting', 'active', 'completed', 'failed']);

      const jobList = await Promise.all(
        jobs.map(async (job) => {
          const state = await job.getState();
          return {
            id: job.id,
            status: state,
            createdAt: new Date(job.timestamp),
          };
        })
      );

      res.json(jobList);
    } catch (error) {
      console.error('[API] Error listing jobs:', error);
      res.status(500).json({
        error: 'Failed to list jobs',
      });
    }
  });

  return router;
}
