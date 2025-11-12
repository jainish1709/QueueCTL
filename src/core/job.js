const { v4: uuidv4 } = require('crypto');

class Job {
  constructor(data) {
    this.id = data.id || this.generateId();
    this.command = data.command;
    this.state = data.state || 'pending';
    this.attempts = data.attempts || 0;
    this.max_retries = data.max_retries || 3;
    this.created_at = data.created_at || new Date().toISOString();
    this.updated_at = data.updated_at || new Date().toISOString();
    this.next_retry_at = data.next_retry_at || null;
    this.locked_by = data.locked_by || null;
    this.locked_at = data.locked_at || null;
    this.completed_at = data.completed_at || null;
    this.error = data.error || null;
  }

  generateId() {
    return `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static fromJSON(json) {
    try {
      const data = typeof json === 'string' ? JSON.parse(json) : json;
      return new Job(data);
    } catch (error) {
      throw new Error(`Invalid job JSON: ${error.message}`);
    }
  }

  toJSON() {
    return {
      id: this.id,
      command: this.command,
      state: this.state,
      attempts: this.attempts,
      max_retries: this.max_retries,
      created_at: this.created_at,
      updated_at: this.updated_at,
      next_retry_at: this.next_retry_at,
      locked_by: this.locked_by,
      locked_at: this.locked_at,
      completed_at: this.completed_at,
      error: this.error
    };
  }

  validate() {
    if (!this.command || typeof this.command !== 'string') {
      throw new Error('Job must have a valid command string');
    }

    if (this.max_retries < 0) {
      throw new Error('max_retries must be non-negative');
    }

    return true;
  }
}

module.exports = Job;
