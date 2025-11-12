const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class JobDatabase {
  constructor() {
    const dataDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    this.db = new Database(path.join(dataDir, 'jobs.db'));
    this.initializeSchema();
  }

  initializeSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        command TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        next_retry_at TEXT,
        locked_by TEXT,
        locked_at TEXT,
        completed_at TEXT,
        error TEXT
      );

      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_state ON jobs(state);
      CREATE INDEX IF NOT EXISTS idx_next_retry ON jobs(next_retry_at);
      CREATE INDEX IF NOT EXISTS idx_locked_by ON jobs(locked_by);
    `);

    // Initialize default config
    const defaultConfig = {
      'max-retries': '3',
      'backoff-base': '2'
    };

    for (const [key, value] of Object.entries(defaultConfig)) {
      const existing = this.getConfig(key);
      if (!existing) {
        this.setConfig(key, value);
      }
    }
  }

  // Job operations
  createJob(job) {
    const stmt = this.db.prepare(`
      INSERT INTO jobs (id, command, state, attempts, max_retries, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    return stmt.run(
      job.id,
      job.command,
      job.state || 'pending',
      job.attempts || 0,
      job.max_retries || 3,
      job.created_at,
      job.updated_at
    );
  }

  getJob(id) {
    const stmt = this.db.prepare('SELECT * FROM jobs WHERE id = ?');
    return stmt.get(id);
  }

  getJobsByState(state) {
    const stmt = this.db.prepare('SELECT * FROM jobs WHERE state = ? ORDER BY created_at ASC');
    return stmt.all(state);
  }

  getAllJobs() {
    const stmt = this.db.prepare('SELECT * FROM jobs ORDER BY created_at DESC');
    return stmt.all();
  }

  updateJobState(id, state, error = null) {
    const stmt = this.db.prepare(`
      UPDATE jobs 
      SET state = ?, updated_at = ?, error = ?, completed_at = ?
      WHERE id = ?
    `);
    
    const now = new Date().toISOString();
    const completedAt = (state === 'completed' || state === 'dead') ? now : null;
    
    return stmt.run(state, now, error, completedAt, id);
  }

  incrementAttempts(id, nextRetryAt = null) {
    const stmt = this.db.prepare(`
      UPDATE jobs 
      SET attempts = attempts + 1, updated_at = ?, next_retry_at = ?
      WHERE id = ?
    `);
    
    return stmt.run(new Date().toISOString(), nextRetryAt, id);
  }

  lockJob(id, workerId) {
    const stmt = this.db.prepare(`
      UPDATE jobs 
      SET locked_by = ?, locked_at = ?, state = 'processing', updated_at = ?
      WHERE id = ? AND (locked_by IS NULL OR locked_by = ?)
    `);
    
    const now = new Date().toISOString();
    const result = stmt.run(workerId, now, now, id, workerId);
    return result.changes > 0;
  }

  unlockJob(id) {
    const stmt = this.db.prepare(`
      UPDATE jobs 
      SET locked_by = NULL, locked_at = NULL
      WHERE id = ?
    `);
    
    return stmt.run(id);
  }

  getNextPendingJob() {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      SELECT * FROM jobs 
      WHERE state = 'pending' 
        AND locked_by IS NULL
        AND (next_retry_at IS NULL OR next_retry_at <= ?)
      ORDER BY created_at ASC 
      LIMIT 1
    `);
    
    return stmt.get(now);
  }

  getJobStats() {
    const stmt = this.db.prepare(`
      SELECT 
        state,
        COUNT(*) as count
      FROM jobs
      GROUP BY state
    `);
    
    const results = stmt.all();
    const stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      dead: 0,
      total: 0
    };
    
    results.forEach(row => {
      stats[row.state] = row.count;
      stats.total += row.count;
    });
    
    return stats;
  }

  resetJobFromDLQ(jobId) {
    const stmt = this.db.prepare(`
      UPDATE jobs 
      SET state = 'pending', 
          attempts = 0, 
          error = NULL,
          next_retry_at = NULL,
          updated_at = ?
      WHERE id = ?
    `);
    
    return stmt.run(new Date().toISOString(), jobId);
  }

  // Config operations
  getConfig(key) {
    const stmt = this.db.prepare('SELECT value FROM config WHERE key = ?');
    const result = stmt.get(key);
    return result ? result.value : null;
  }

  setConfig(key, value) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO config (key, value)
      VALUES (?, ?)
    `);
    
    return stmt.run(key, value.toString());
  }

  getAllConfig() {
    const stmt = this.db.prepare('SELECT * FROM config');
    return stmt.all();
  }

  // Cleanup
  close() {
    this.db.close();
  }
}

module.exports = JobDatabase;