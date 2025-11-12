const { exec } = require('child_process');
const Queue = require('./queue');
const Logger = require('../utils/logger');
const BackoffCalculator = require('../utils/backoff');

class Worker {
  constructor(workerId) {
    this.workerId = workerId;
    this.queue = new Queue();
    this.isRunning = false;
    this.currentJob = null;
    this.pollInterval = 1000; // 1 second
    this.pollTimer = null;
  }

  /**
   * Start the worker
   */
  start() {
    this.isRunning = true;
    Logger.worker(this.workerId, 'Started');
    this.poll();
  }

  /**
   * Stop the worker gracefully
   */
  async stop() {
    this.isRunning = false;
    
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
    }

    // Wait for current job to complete
    if (this.currentJob) {
      Logger.worker(this.workerId, `Waiting for current job to complete: ${this.currentJob}`);
      await this.waitForJobCompletion();
    }

    this.queue.close();
    Logger.worker(this.workerId, 'Stopped');
  }

  /**
   * Wait for current job to complete
   */
  waitForJobCompletion() {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!this.currentJob) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Poll for jobs
   */
  poll() {
    if (!this.isRunning) {
      return;
    }

    this.processNextJob()
      .then(() => {
        // Schedule next poll
        if (this.isRunning) {
          this.pollTimer = setTimeout(() => this.poll(), this.pollInterval);
        }
      })
      .catch((error) => {
        Logger.error(`Worker ${this.workerId} error: ${error.message}`);
        if (this.isRunning) {
          this.pollTimer = setTimeout(() => this.poll(), this.pollInterval);
        }
      });
  }

  /**
   * Process the next available job
   */
  async processNextJob() {
    try {
      const job = this.queue.getNextJob();

      if (!job) {
        // No jobs available
        return;
      }

      // Try to lock the job
      const locked = this.queue.lockJob(job.id, this.workerId);

      if (!locked) {
        // Another worker got this job
        return;
      }

      this.currentJob = job.id;
      Logger.worker(this.workerId, `Processing job: ${job.id}`);
      Logger.worker(this.workerId, `Command: ${job.command}`);

      try {
        await this.executeJob(job);
        this.queue.completeJob(job.id);
        Logger.worker(this.workerId, `Job completed: ${job.id}`);
      } catch (error) {
        Logger.worker(this.workerId, `Job failed: ${job.id} - ${error.message}`);
        
        // Calculate next retry time with exponential backoff
        const backoffBase = parseInt(this.queue.getConfig('backoff-base') || '2');
        const nextRetryAt = BackoffCalculator.getNextRetryTime(job.attempts, backoffBase);
        const delay = BackoffCalculator.calculate(job.attempts, backoffBase);
        
        Logger.worker(
          this.workerId, 
          `Next retry in ${BackoffCalculator.formatDelay(delay)} (at ${nextRetryAt})`
        );
        
        this.queue.failJob(job.id, error.message, nextRetryAt);
      }

      this.currentJob = null;
    } catch (error) {
      this.currentJob = null;
      throw error;
    }
  }

  /**
   * Execute a job command
   */
  executeJob(job) {
    return new Promise((resolve, reject) => {
      exec(job.command, { timeout: 300000 }, (error, stdout, stderr) => {
        if (error) {
          // Command failed or not found
          reject(new Error(stderr || error.message));
        } else {
          if (stdout) {
            Logger.worker(this.workerId, `Output: ${stdout.trim()}`);
          }
          resolve(stdout);
        }
      });
    });
  }
}

/**
 * Worker Pool Manager
 */
class WorkerPool {
  constructor() {
    this.workers = [];
    this.isRunning = false;
  }

  /**
   * Start multiple workers
   */
  start(count = 1) {
    if (this.isRunning) {
      Logger.warn('Workers are already running');
      return;
    }

    this.isRunning = true;
    Logger.info(`Starting ${count} worker(s)...`);

    for (let i = 0; i < count; i++) {
      const worker = new Worker(`W${i + 1}`);
      worker.start();
      this.workers.push(worker);
    }

    Logger.success(`${count} worker(s) started successfully`);

    // Handle graceful shutdown
    this.setupSignalHandlers();
  }

  /**
   * Stop all workers gracefully
   */
  async stop() {
    if (!this.isRunning) {
      Logger.warn('No workers are running');
      return;
    }

    Logger.info('Stopping workers gracefully...');
    this.isRunning = false;

    const stopPromises = this.workers.map(worker => worker.stop());
    await Promise.all(stopPromises);

    this.workers = [];
    Logger.success('All workers stopped');
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  setupSignalHandlers() {
    const shutdown = async (signal) => {
      Logger.info(`\nReceived ${signal}, shutting down gracefully...`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }

  /**
   * Get active worker count
   */
  getActiveCount() {
    return this.workers.length;
  }
}

module.exports = { Worker, WorkerPool };
