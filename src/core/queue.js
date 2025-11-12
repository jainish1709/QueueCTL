const JobDatabase = require('../storage/database');
const Job = require('./job');
const Logger = require('../utils/logger');

class Queue {
  constructor() {
    this.db = new JobDatabase();
  }

  /**
   * Enqueue a new job
   */
  enqueue(jobData) {
    try {
      const job = Job.fromJSON(jobData);
      job.validate();
      
      this.db.createJob(job.toJSON());
      Logger.success(`Job enqueued: ${job.id}`);
      return job;
    } catch (error) {
      Logger.error(`Failed to enqueue job: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get job by ID
   */
  getJob(id) {
    return this.db.getJob(id);
  }

  /**
   * Get all jobs by state
   */
  getJobsByState(state) {
    return this.db.getJobsByState(state);
  }

  /**
   * Get all jobs
   */
  getAllJobs() {
    return this.db.getAllJobs();
  }

  /**
   * Get job statistics
   */
  getStats() {
    return this.db.getJobStats();
  }

  /**
   * Get next pending job for processing
   */
  getNextJob() {
    return this.db.getNextPendingJob();
  }

  /**
   * Lock a job for processing
   */
  lockJob(jobId, workerId) {
    return this.db.lockJob(jobId, workerId);
  }

  /**
   * Unlock a job
   */
  unlockJob(jobId) {
    return this.db.unlockJob(jobId);
  }

  /**
   * Mark job as completed
   */
  completeJob(jobId) {
    this.db.updateJobState(jobId, 'completed');
    this.db.unlockJob(jobId);
    Logger.success(`Job completed: ${jobId}`);
  }

  /**
   * Mark job as failed and handle retry logic
   */
  failJob(jobId, error, nextRetryAt = null) {
    const job = this.db.getJob(jobId);
    
    if (!job) {
      Logger.error(`Job not found: ${jobId}`);
      return;
    }

    this.db.incrementAttempts(jobId, nextRetryAt);
    
    if (job.attempts + 1 >= job.max_retries) {
      // Move to DLQ
      this.db.updateJobState(jobId, 'dead', error);
      Logger.warn(`Job moved to DLQ: ${jobId} (max retries exceeded)`);
    } else {
      // Mark as failed for retry
      this.db.updateJobState(jobId, 'pending', error);
      Logger.warn(`Job failed, will retry: ${jobId} (attempt ${job.attempts + 1}/${job.max_retries})`);
    }
    
    this.db.unlockJob(jobId);
  }

  /**
   * Retry a job from DLQ
   */
  retryFromDLQ(jobId) {
    const job = this.db.getJob(jobId);
    
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.state !== 'dead') {
      throw new Error(`Job ${jobId} is not in DLQ (current state: ${job.state})`);
    }

    // Reset job for retry - use database resetJobFromDLQ method
    this.db.resetJobFromDLQ(jobId);

    Logger.success(`Job ${jobId} moved from DLQ to pending queue`);
  }

  /**
   * Get configuration value
   */
  getConfig(key) {
    return this.db.getConfig(key);
  }

  /**
   * Set configuration value
   */
  setConfig(key, value) {
    this.db.setConfig(key, value);
    Logger.success(`Configuration updated: ${key} = ${value}`);
  }

  /**
   * Get all configuration
   */
  getAllConfig() {
    return this.db.getAllConfig();
  }

  /**
   * Close database connection
   */
  close() {
    this.db.close();
  }
}

module.exports = Queue;